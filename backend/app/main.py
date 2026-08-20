from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Pranexa API",
    version="0.1.0",
)

# Allow the Next.js frontend to communicate with FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.56.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "service": "Pranexa API",
        "version": "0.1.0",
        "status": "running",
    }


@app.post("/api/v1/chat")
def chat(request: dict):
    message = request.get("message", "")
    mode = request.get("mode", "explain")

    return {
        "response": f"Pranexa received your message: {message}",
        "mode": mode,
    }