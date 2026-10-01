import unittest
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from unittest.mock import patch

import httpx
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from supabase import AuthApiError

from app.api.dependencies.auth import AuthenticatedUser, get_authenticated_user
from app.database import supabase_client


class FakePostgrest:
    def __init__(self):
        self.token = None

    def auth(self, token):
        self.token = token


class FakeAuth:
    def __init__(self, client):
        self.client = client

    def get_user(self, token):
        if token == "invalid":
            raise AuthApiError("invalid", 401, None)
        if token == "expired":
            raise AuthApiError("expired", 401, None)
        if token == "rate-limited":
            raise AuthApiError("rate-limited", 429, None)
        if token == "unavailable":
            raise httpx.ConnectError("offline")
        return SimpleNamespace(
            user=SimpleNamespace(
                id={
                    "credential-alpha": "user-alpha",
                    "first": "user-first",
                    "second": "user-second",
                }.get(token, "verified-user-id")
            )
        )

    def close(self):
        self.client.closed = True


class FakeSupabaseClient:
    def __init__(self):
        self.postgrest = FakePostgrest()
        self.auth = FakeAuth(self)
        self.closed = False


class AuthenticationTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()

        @app.get("/identity")
        def get_identity(
            authenticated_user: AuthenticatedUser = Depends(get_authenticated_user),
        ):
            return {"user_id": authenticated_user.user_id}

        self.app = app
        self.clients = []

        def create_client(token):
            client = FakeSupabaseClient()
            client.postgrest.auth(token)
            self.clients.append(client)
            return client

        self.client_factory = patch(
            "app.api.dependencies.auth.create_user_supabase_client",
            side_effect=create_client,
        )
        self.client_factory.start()
        self.addCleanup(self.client_factory.stop)
        self.http = TestClient(app)
        self.addCleanup(self.http.close)

    def test_missing_authorization_returns_401(self):
        response = self.http.get("/identity")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.headers["www-authenticate"], "Bearer")
        self.assertEqual(self.clients, [])

    def test_malformed_authorization_returns_401(self):
        response = self.http.get(
            "/identity",
            headers={"Authorization": "Bearer token extra"},
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.headers["www-authenticate"], "Bearer")

    def test_wrong_scheme_returns_401(self):
        response = self.http.get(
            "/identity",
            headers={"Authorization": "Basic token"},
        )
        self.assertEqual(response.status_code, 401)

    def test_empty_bearer_token_returns_401(self):
        response = self.http.get(
            "/identity",
            headers={"Authorization": "Bearer"},
        )
        self.assertEqual(response.status_code, 401)

    def test_invalid_token_returns_generic_401(self):
        response = self.http.get(
            "/identity",
            headers={"Authorization": "Bearer invalid"},
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.headers["www-authenticate"], "Bearer")
        self.assertNotIn("invalid", response.text)
        self.assertTrue(self.clients[-1].closed)

    def test_expired_token_returns_generic_401(self):
        response = self.http.get(
            "/identity",
            headers={"Authorization": "Bearer expired"},
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.headers["www-authenticate"], "Bearer")
        self.assertNotIn("expired", response.text)

    def test_auth_provider_rate_limit_returns_503(self):
        response = self.http.get(
            "/identity",
            headers={"Authorization": "Bearer rate-limited"},
        )
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("rate-limited", response.text)

    def test_auth_provider_failure_returns_503(self):
        response = self.http.get(
            "/identity",
            headers={"Authorization": "Bearer unavailable"},
        )
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("offline", response.text)
        self.assertTrue(self.clients[-1].closed)

    def test_valid_token_returns_verified_user_id_and_closes_client(self):
        response = self.http.get(
            "/identity",
            headers={"Authorization": "Bearer credential-alpha"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"user_id": "user-alpha"})
        self.assertEqual(self.clients[-1].postgrest.token, "credential-alpha")
        self.assertTrue(self.clients[-1].closed)
        self.assertNotIn("credential-alpha", response.text)

    def test_real_request_clients_are_isolated_and_close_their_http_resources(self):
        with patch.object(
            supabase_client,
            "SUPABASE_PUBLISHABLE_KEY",
            "test-publishable-key",
        ):
            first = supabase_client.create_user_supabase_client("token-one")
            second = supabase_client.create_user_supabase_client("token-two")

        first_transport = first.postgrest.session
        second_transport = second.postgrest.session
        self.assertIsNot(first, second)
        self.assertIsNot(first_transport, second_transport)
        self.assertEqual(
            first.postgrest.headers["Authorization"],
            "Bearer token-one",
        )
        self.assertEqual(
            second.postgrest.headers["Authorization"],
            "Bearer token-two",
        )

        first.auth.close()
        second.auth.close()
        self.assertTrue(first_transport.is_closed)
        self.assertTrue(second_transport.is_closed)

    def test_concurrent_requests_do_not_share_client_or_token(self):
        def request(token):
            return self.http.get(
                "/identity",
                headers={"Authorization": f"Bearer {token}"},
            )

        with ThreadPoolExecutor(max_workers=2) as executor:
            first, second = list(executor.map(request, ("first", "second")))

        self.assertEqual(first.json(), {"user_id": "user-first"})
        self.assertEqual(second.json(), {"user_id": "user-second"})
        self.assertEqual(
            {client.postgrest.token for client in self.clients},
            {"first", "second"},
        )
        self.assertEqual(len({id(client) for client in self.clients}), 2)
        self.assertTrue(all(client.closed for client in self.clients))


if __name__ == "__main__":
    unittest.main()
