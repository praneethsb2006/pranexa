import unittest
from unittest.mock import patch

from fastapi import Request
from fastapi.testclient import TestClient

from app.api.dependencies.auth import AuthenticatedUser, get_authenticated_user
from app.main import app
from app.schemas.chat import ChatMessage
from app.services.ai_service import AIServiceUnavailable


class QueryResult:
    def __init__(self, data):
        self.data = data


class FakeQuery:
    def __init__(self, database, table_name):
        self.database = database
        self.table_name = table_name
        self.filters = []
        self.ordering = None
        self.row_limit = None
        self.payload = None
        self.operation = "select"

    def select(self, _fields):
        self.operation = "select"
        return self

    def eq(self, field, value):
        self.filters.append((field, value))
        return self

    def order(self, field, desc=False):
        self.ordering = (field, desc)
        return self

    def limit(self, value):
        self.row_limit = value
        return self

    def insert(self, payload):
        self.operation = "insert"
        self.payload = payload
        return self

    def execute(self):
        rows = self.database.tables[self.table_name]
        if self.operation == "insert":
            row = dict(self.payload)
            if self.table_name == "conversations":
                row.update(
                    id=f"conversation-{len(rows) + 1}",
                    created_at="2026-09-27T00:00:00+00:00",
                )
            else:
                row.update(
                    id=f"message-{len(rows) + 1}",
                    created_at=f"2026-09-27T00:00:{len(rows):02d}+00:00",
                )
            rows.append(row)
            return QueryResult([row])

        selected = [
            row
            for row in rows
            if all(row.get(field) == value for field, value in self.filters)
        ]
        if self.ordering:
            field, descending = self.ordering
            selected.sort(key=lambda row: row[field], reverse=descending)
        if self.row_limit is not None:
            selected = selected[: self.row_limit]
        return QueryResult(selected)


class FakeDatabase:
    def __init__(self):
        self.tables = {"conversations": [], "messages": []}

    def table(self, table_name):
        return FakeQuery(self, table_name)


class FakeRequestClient:
    def __init__(self, database):
        self.database = database

    def table(self, table_name):
        return self.database.table(table_name)


class ChatOwnershipTests(unittest.TestCase):
    def setUp(self):
        self.database = FakeDatabase()

        def authenticated_user(request: Request):
            token = request.headers.get("Authorization", "").removeprefix("Bearer ")
            return AuthenticatedUser(
                user_id=f"user-{token}",
                supabase=FakeRequestClient(self.database),
            )

        app.dependency_overrides[get_authenticated_user] = authenticated_user
        self.addCleanup(app.dependency_overrides.clear)
        self.http = TestClient(app)
        self.addCleanup(self.http.close)
        self.ai_patch = patch(
            "app.services.chat_service.generate_ai_response",
            side_effect=self.generate_ai_response,
        )
        self.ai_mock = self.ai_patch.start()
        self.addCleanup(self.ai_patch.stop)
        self.ai_history = []

    async def generate_ai_response(self, *, message, mode, history):
        self.ai_history.append((message, mode, list(history)))
        return "AI response"

    def headers(self, user):
        return {"Authorization": f"Bearer {user}"}

    def create_conversation(self, user, message="Question", **extra):
        response = self.http.post(
            "/chat",
            headers=self.headers(user),
            json={"message": message, "mode": "explain", **extra},
        )
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["conversation_id"]

    def test_new_conversation_uses_verified_user_id_not_request_user_id(self):
        response = self.http.post(
            "/chat",
            headers=self.headers("alice"),
            json={
                "message": "Question",
                "mode": "explain",
                "user_id": "user-bob",
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        conversation = self.database.tables["conversations"][0]
        self.assertEqual(conversation["user_id"], "user-alice")
        self.assertNotEqual(conversation["user_id"], "user-bob")
        self.assertEqual(response.json()["response"], "AI response")

    def test_gemini_unavailability_returns_503_without_persisting_failed_turn(self):
        self.ai_mock.side_effect = AIServiceUnavailable(
            "Pranexa's AI service is temporarily busy. Please try again in a moment."
        )

        response = self.http.post(
            "/chat",
            headers=self.headers("alice"),
            json={"message": "Question", "mode": "explain"},
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.json()["detail"],
            "Pranexa's AI service is temporarily busy. Please try again in a moment.",
        )
        self.assertEqual(self.database.tables["conversations"], [])
        self.assertEqual(self.database.tables["messages"], [])

    def test_gemini_unavailability_does_not_persist_message_to_existing_conversation(self):
        conversation_id = self.create_conversation("alice", "Prior question")
        messages_before_failure = list(self.database.tables["messages"])
        self.ai_mock.side_effect = AIServiceUnavailable(
            "Pranexa's AI service is temporarily busy. Please try again in a moment."
        )

        response = self.http.post(
            "/chat",
            headers=self.headers("alice"),
            json={
                "message": "Retryable question",
                "mode": "explain",
                "conversation_id": conversation_id,
            },
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(self.database.tables["messages"], messages_before_failure)

    def test_user_can_continue_own_conversation(self):
        conversation_id = self.create_conversation("alice")
        response = self.http.post(
            "/chat",
            headers=self.headers("alice"),
            json={
                "message": "Follow up",
                "mode": "learn",
                "conversation_id": conversation_id,
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["conversation_id"], conversation_id)

    def test_user_cannot_continue_another_users_conversation(self):
        conversation_id = self.create_conversation("alice")
        message_count = len(self.database.tables["messages"])
        ai_call_count = self.ai_mock.call_count

        response = self.http.post(
            "/chat",
            headers=self.headers("bob"),
            json={
                "message": "Should not be processed",
                "mode": "explain",
                "conversation_id": conversation_id,
            },
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(len(self.database.tables["messages"]), message_count)
        self.assertEqual(self.ai_mock.call_count, ai_call_count)

    def test_conversation_list_contains_only_authenticated_users_rows(self):
        alice_conversation = self.create_conversation("alice", "Alice question")
        bob_conversation = self.create_conversation("bob", "Bob question")

        response = self.http.get("/conversations", headers=self.headers("alice"))
        self.assertEqual(response.status_code, 200)
        conversation_ids = {
            conversation["id"] for conversation in response.json()["conversations"]
        }
        self.assertIn(alice_conversation, conversation_ids)
        self.assertNotIn(bob_conversation, conversation_ids)

    def test_user_cannot_retrieve_another_users_messages_or_conversation(self):
        conversation_id = self.create_conversation("alice")

        response = self.http.get(
            f"/conversations/{conversation_id}/messages",
            headers=self.headers("bob"),
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "Conversation not found.")

    def test_history_uses_latest_50_in_chronological_order_without_current_prompt(self):
        conversation_id = self.create_conversation("alice")
        self.database.tables["messages"] = [
            {
                "id": f"message-{index}",
                "conversation_id": conversation_id,
                "role": "user" if index % 2 == 0 else "assistant",
                "content": f"prior-{index}",
                "created_at": f"2026-09-27T00:{index // 60:02d}:{index % 60:02d}+00:00",
            }
            for index in range(60)
        ]

        response = self.http.post(
            "/chat",
            headers=self.headers("alice"),
            json={
                "message": "current prompt",
                "mode": "explain",
                "conversation_id": conversation_id,
            },
        )
        self.assertEqual(response.status_code, 200, response.text)

        history = self.ai_history[-1][2]
        self.assertEqual(len(history), 50)
        self.assertTrue(all(isinstance(item, ChatMessage) for item in history))
        self.assertEqual(
            [item.content for item in history],
            [f"prior-{index}" for index in range(10, 60)],
        )
        self.assertNotIn("current prompt", [item.content for item in history])

    def test_missing_conversation_returns_404_before_ai(self):
        ai_call_count = self.ai_mock.call_count
        response = self.http.post(
            "/chat",
            headers=self.headers("alice"),
            json={
                "message": "Question",
                "mode": "explain",
                "conversation_id": "missing",
            },
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.ai_mock.call_count, ai_call_count)
        self.assertEqual(self.database.tables["messages"], [])

    def test_get_owned_messages_keeps_chronological_order(self):
        conversation_id = self.create_conversation("alice")
        response = self.http.get(
            f"/conversations/{conversation_id}/messages",
            headers=self.headers("alice"),
        )
        self.assertEqual(response.status_code, 200)
        roles = [message["role"] for message in response.json()["messages"]]
        self.assertEqual(roles, ["user", "assistant"])


if __name__ == "__main__":
    unittest.main()
