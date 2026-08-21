from typing import Protocol


class AIProvider(Protocol):
    async def generate_response(self, message: str, mode: str) -> str:
        ...


class MockAIProvider:
    """
    Temporary AI provider used while we build and test Pranexa.

    This lets us test the complete application flow before
    connecting a real AI model.
    """

    async def generate_response(self, message: str, mode: str) -> str:
        return (
            f"Pranexa is ready to explain this.\n\n"
            f"Your question: {message}\n\n"
            f"Mode: {mode}\n\n"
            f"Next, we'll connect the real AI engine."
        )


ai_provider: AIProvider = MockAIProvider()


async def generate_ai_response(message: str, mode: str) -> str:
    return await ai_provider.generate_response(message, mode)