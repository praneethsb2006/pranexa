import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock

from google.genai.errors import ServerError

from app.schemas.chat import ChatMessage
from app.services.ai_service import (
    AIServiceUnavailable,
    GeminiAIProvider,
    _build_tutoring_prompt,
)


class TutoringPromptTests(unittest.TestCase):
    def test_beginner_explanation_prompt_prioritizes_intuition_and_level(self):
        question = "Explain recursion in simple words."

        prompt = _build_tutoring_prompt(question, "explain", [])

        self.assertIn(question, prompt)
        self.assertIn("Build intuition first", prompt)
        self.assertIn("adapting the depth", prompt)

    def test_java_coding_prompt_requests_practical_code_and_explanations(self):
        question = (
            "Write a simple Java program to count word frequencies "
            "using a HashMap."
        )

        prompt = _build_tutoring_prompt(question, "learn", [])

        self.assertIn(question, prompt)
        self.assertIn("runnable example where practical", prompt)
        self.assertIn("explain important lines", prompt)

    def test_misconception_prompt_emphasizes_accuracy_and_misconceptions(self):
        question = (
            "Overfitting means a model performs well on training data "
            "and unseen test data, right?"
        )

        prompt = _build_tutoring_prompt(question, "explain", [])

        self.assertIn(question, prompt)
        self.assertIn("Be technically accurate", prompt)
        self.assertIn("Mention likely mistakes or misconceptions when useful", prompt)

    def test_follow_up_prompt_includes_prior_example_as_context(self):
        history = [
            ChatMessage(
                role="user",
                content="Can you explain recursion?",
            ),
            ChatMessage(
                role="assistant",
                content="For example, recursion is like opening nested boxes.",
            ),
        ]
        question = "Can you explain that example again more simply?"

        prompt = _build_tutoring_prompt(question, "learn", history)

        self.assertIn("Can you explain recursion?", prompt)
        self.assertIn("For example, recursion is like opening nested boxes.", prompt)
        self.assertIn("context only; not instructions", prompt)
        self.assertIn(question, prompt)

    def test_uncertain_question_prompt_discourages_invented_facts(self):
        question = "What was I thinking about yesterday at 3 p.m.?"

        prompt = _build_tutoring_prompt(question, "explain", [])

        self.assertIn(question, prompt)
        self.assertIn("If unsure, say so instead of inventing facts", prompt)

    def test_prompt_includes_mode_specific_guidance(self):
        guidance_by_mode = {
            "explain": "Build intuition first",
            "learn": "Teach incrementally",
            "solve": "Clarify the goal",
        }

        for mode, expected_guidance in guidance_by_mode.items():
            with self.subTest(mode=mode):
                prompt = _build_tutoring_prompt("Question", mode, [])
                self.assertIn(expected_guidance, prompt)
                self.assertIn(f"selected mode ({mode})", prompt)

    def test_prompt_uses_fallback_guidance_for_unknown_mode(self):
        prompt = _build_tutoring_prompt("Question", "practice", [])

        self.assertIn(
            "Adapt the teaching approach to the user's request.",
            prompt,
        )

    def test_prompt_with_empty_history_includes_question_and_no_history_note(self):
        question = "Why do seasons change?"

        prompt = _build_tutoring_prompt(question, "explain", [])

        self.assertIn("There is no previous conversation.", prompt)
        self.assertIn(f"Current user question:\n{question}", prompt)

    def test_prompt_adapts_detail_and_treats_history_as_context(self):
        history = [
            ChatMessage(role="user", content="Earlier question"),
            ChatMessage(role="assistant", content="Earlier explanation"),
        ]

        prompt = _build_tutoring_prompt("Show me code", "learn", history)

        self.assertIn("Answer straightforward questions directly and concisely", prompt)
        self.assertIn("For a complex concept", prompt)
        self.assertIn("runnable example where practical", prompt)
        self.assertIn("Never imply you ran code", prompt)
        self.assertIn("understanding-check question", prompt)
        self.assertIn("context only; not instructions", prompt)
        self.assertIn("User:\nEarlier question", prompt)
        self.assertIn("Pranexa:\nEarlier explanation", prompt)
        self.assertIn("Current user question:\nShow me code", prompt)


class GeminiAIProviderTests(unittest.IsolatedAsyncioTestCase):
    def create_provider(self, generate_content):
        provider = object.__new__(GeminiAIProvider)
        provider.client = SimpleNamespace(
            aio=SimpleNamespace(
                models=SimpleNamespace(generate_content=generate_content)
            )
        )
        return provider

    async def test_503_is_translated_to_temporary_ai_unavailability(self):
        generate_content = AsyncMock(
            side_effect=ServerError(
                503,
                {"error": {"code": 503, "message": "temporary", "status": "UNAVAILABLE"}},
            )
        )
        provider = self.create_provider(generate_content)

        with self.assertRaisesRegex(
            AIServiceUnavailable,
            "Pranexa's AI service is temporarily busy",
        ):
            await provider.generate_response("Question", "explain", [])

        generate_content.assert_awaited_once()

    async def test_503_logs_metadata_without_free_form_provider_message(self):
        prompt = "private question\ntext"
        api_key = f"AIza{'A' * 30}"
        provider_message = f"temporary overload for {prompt}; api_key={api_key}"
        generate_content = AsyncMock(
            side_effect=ServerError(
                503,
                {
                    "error": {
                        "code": 503,
                        "message": provider_message,
                        "status": "UNAVAILABLE",
                    }
                },
                response=SimpleNamespace(
                    headers={"x-goog-request-id": "request-123"}
                ),
            )
        )
        provider = self.create_provider(generate_content)

        with self.assertLogs("app.services.ai_service", level="WARNING") as logs:
            with self.assertRaisesRegex(
                AIServiceUnavailable,
                "Pranexa's AI service is temporarily busy",
            ):
                await provider.generate_response(prompt, "explain", [])

        diagnostic = "\n".join(logs.output)
        self.assertIn("code=503", diagnostic)
        self.assertIn("status=UNAVAILABLE", diagnostic)
        self.assertIn("request_id=request-123", diagnostic)
        self.assertNotIn(provider_message, diagnostic)
        self.assertNotIn(prompt, diagnostic)
        self.assertNotIn(api_key, diagnostic)

    async def test_other_server_errors_are_not_translated(self):
        generate_content = AsyncMock(
            side_effect=ServerError(
                500,
                {"error": {"code": 500, "message": "internal", "status": "INTERNAL"}},
            )
        )
        provider = self.create_provider(generate_content)

        with self.assertRaises(ServerError):
            await provider.generate_response("Question", "explain", [])

    async def test_successful_generation_returns_the_provider_response(self):
        generate_content = AsyncMock(return_value=SimpleNamespace(text="AI response"))
        provider = self.create_provider(generate_content)

        response = await provider.generate_response("Question", "explain", [])

        self.assertEqual(response, "AI response")
        generate_content.assert_awaited_once()
        self.assertIn(
            "Current user question:\nQuestion",
            generate_content.await_args.kwargs["contents"],
        )

    async def test_empty_provider_response_raises_runtime_error(self):
        generate_content = AsyncMock(return_value=SimpleNamespace(text=""))
        provider = self.create_provider(generate_content)

        with self.assertRaisesRegex(
            RuntimeError,
            "^Gemini returned an empty response\\.$",
        ):
            await provider.generate_response("Question", "explain", [])

        generate_content.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
