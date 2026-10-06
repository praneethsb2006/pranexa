import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock

from google.genai.errors import ServerError

from app.services.ai_service import AIServiceUnavailable, GeminiAIProvider


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


if __name__ == "__main__":
    unittest.main()
