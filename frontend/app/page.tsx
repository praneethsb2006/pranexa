"use client";

import { useEffect, useRef, useState } from "react";

type ChatMode = "explain" | "learn" | "solve";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const API_URL = "http://127.0.0.1:8000/api/v1/chat";

const modeLabels: Record<ChatMode, string> = {
  explain: "Explain mode",
  learn: "Learn mode",
  solve: "Solve mode",
};

export default function Home() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ChatMode>("explain");

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  const handleSubmit = async (
    event?: React.FormEvent<HTMLFormElement>
  ) => {
    event?.preventDefault();

    const userMessage = message.trim();

    if (!userMessage || loading) {
      return;
    }

    const userMessageObject: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: userMessage,
    };

    setMessages((currentMessages) => [
      ...currentMessages,
      userMessageObject,
    ]);

    setMessage("");
    setLoading(true);

    try {
      const apiResponse = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          mode,
        }),
      });

      if (!apiResponse.ok) {
        throw new Error(
          `Backend returned status ${apiResponse.status}`
        );
      }

      const data: {
        response?: string;
        mode?: string;
      } = await apiResponse.json();

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          data.response ||
          "I received your message, but I don't have a response yet.",
      };

      setMessages((currentMessages) => [
        ...currentMessages,
        assistantMessage,
      ]);
    } catch (error) {
      console.error("Pranexa error:", error);

      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "I couldn't connect to the Pranexa backend. Please make sure the FastAPI server is running and try again.",
      };

      setMessages((currentMessages) => [
        ...currentMessages,
        errorMessage,
      ]);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  };

  const handleTextareaKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      if (!loading && message.trim()) {
        void handleSubmit();
      }
    }
  };

  const startNewChat = () => {
    if (loading) {
      return;
    }

    setMessages([]);
    setMessage("");
    setMode("explain");

    textareaRef.current?.focus();
  };

  const selectMode = (selectedMode: ChatMode) => {
    if (loading) {
      return;
    }

    setMode(selectedMode);
    textareaRef.current?.focus();
  };

  const hasMessages = messages.length > 0;

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#1f1f1f]">
      <div className="flex min-h-screen">

        {/* Sidebar */}
        <aside className="hidden w-[260px] shrink-0 flex-col border-r border-black/5 bg-[#efefec] px-4 py-5 md:flex">

          {/* Logo */}
          <div className="mb-8 flex items-center gap-2 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1f1f1f] text-sm font-semibold text-white">
              P
            </div>

            <span className="text-lg font-semibold tracking-tight">
              Pranexa
            </span>
          </div>

          {/* New Chat */}
          <button
            type="button"
            onClick={startNewChat}
            disabled={loading}
            className="mb-7 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="text-lg">+</span>
            New chat
          </button>

          {/* Workspace */}
          <div className="mb-3 px-3 text-xs font-medium uppercase tracking-wider text-black/40">
            Workspace
          </div>

          <nav className="space-y-1">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl bg-black/5 px-3 py-2.5 text-sm"
            >
              <span>◉</span>
              Chats
            </button>

            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition hover:bg-black/5"
            >
              <span>▣</span>
              Documents
            </button>

            <button
              type="button"
              onClick={() => selectMode("learn")}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                mode === "learn"
                  ? "bg-black/5"
                  : "hover:bg-black/5"
              }`}
            >
              <span>✦</span>
              Learn
            </button>
          </nav>

          {/* Recent */}
          <div className="mt-8 px-3 text-xs font-medium uppercase tracking-wider text-black/40">
            Recent
          </div>

          <div className="mt-3 px-3 text-sm text-black/40">
            {hasMessages
              ? "Current conversation"
              : "No conversations yet"}
          </div>

          {/* Bottom */}
          <div className="mt-auto border-t border-black/5 pt-4">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition hover:bg-black/5"
            >
              <span>⚙</span>
              Settings
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <section className="flex min-h-screen min-w-0 flex-1 flex-col">

          {/* Header */}
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-black/5 px-5 md:px-8">

            <div className="flex items-center gap-3 md:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1f1f1f] text-xs font-semibold text-white">
                P
              </div>

              <span className="font-semibold">
                Pranexa
              </span>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm text-black/60 transition hover:bg-black/5"
              >
                Help
              </button>

              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1f1f1f] text-xs font-semibold text-white"
              >
                PG
              </button>
            </div>
          </header>

          {/* Chat / Empty State */}
          <div className="flex min-h-0 flex-1 flex-col">

            {!hasMessages ? (
              /* Empty State */
              <div className="flex flex-1 items-center justify-center px-5 py-12">
                <div className="w-full max-w-3xl">

                  <div className="mb-8 text-center">

                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1f1f1f] text-xl font-semibold text-white shadow-sm">
                      P
                    </div>

                    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                      What do you want to understand?
                    </h1>

                    <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-black/50 sm:text-base">
                      Ask Pranexa anything. Learn complex topics,
                      solve problems, understand documents, and
                      build your knowledge step by step.
                    </p>

                  </div>

                  <ChatComposer
                    message={message}
                    setMessage={setMessage}
                    loading={loading}
                    mode={mode}
                    textareaRef={textareaRef}
                    onSubmit={handleSubmit}
                    onKeyDown={handleTextareaKeyDown}
                    onModeChange={selectMode}
                  />

                  <CapabilityCards
                    mode={mode}
                    onModeChange={selectMode}
                  />

                  <p className="mt-8 text-center text-xs text-black/30">
                    Pranexa can make mistakes. Always verify important
                    information.
                  </p>

                </div>
              </div>
            ) : (
              /* Conversation */
              <>
                <div className="flex-1 overflow-y-auto px-5 py-8">
                  <div className="mx-auto w-full max-w-3xl space-y-7">

                    {messages.map((item) => (
                      <MessageBubble
                        key={item.id}
                        message={item}
                      />
                    ))}

                    {loading && (
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#1f1f1f] text-xs font-semibold text-white">
                          P
                        </div>

                        <div className="pt-1">
                          <div className="mb-1 text-sm font-medium">
                            Pranexa
                          </div>

                          <div className="flex items-center gap-1 text-sm text-black/40">
                            <span>Thinking</span>
                            <span className="animate-pulse">•</span>
                            <span
                              className="animate-pulse"
                              style={{ animationDelay: "150ms" }}
                            >
                              •
                            </span>
                            <span
                              className="animate-pulse"
                              style={{ animationDelay: "300ms" }}
                            >
                              •
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                </div>

                <div className="border-t border-black/5 bg-[#f7f7f5] px-5 py-4 md:px-8">
                  <div className="mx-auto w-full max-w-3xl">
                    <ChatComposer
                      message={message}
                      setMessage={setMessage}
                      loading={loading}
                      mode={mode}
                      textareaRef={textareaRef}
                      onSubmit={handleSubmit}
                      onKeyDown={handleTextareaKeyDown}
                      onModeChange={selectMode}
                    />

                    <p className="mt-3 text-center text-xs text-black/30">
                      {modeLabels[mode]} · Pranexa can make mistakes.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

type ChatComposerProps = {
  message: string;
  setMessage: (value: string) => void;
  loading: boolean;
  mode: ChatMode;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onSubmit: (event?: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
  onKeyDown: (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => void;
  onModeChange: (mode: ChatMode) => void;
};

function ChatComposer({
  message,
  setMessage,
  loading,
  mode,
  textareaRef,
  onSubmit,
  onKeyDown,
  onModeChange,
}: ChatComposerProps) {
  return (
    <form onSubmit={onSubmit}>
      <div className="rounded-2xl border border-black/10 bg-white p-2 shadow-sm transition focus-within:border-black/20 focus-within:shadow-md">

        <textarea
          ref={textareaRef}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask anything..."
          rows={3}
          disabled={loading}
          aria-label="Message Pranexa"
          className="w-full resize-none border-none bg-transparent px-4 py-3 text-sm outline-none placeholder:text-black/35 disabled:cursor-not-allowed disabled:opacity-50"
        />

        <div className="flex items-center justify-between gap-2 px-2 pb-1">

          <div className="flex min-w-0 items-center gap-1">

            <button
              type="button"
              disabled={loading}
              className="rounded-lg px-3 py-2 text-xs text-black/50 transition hover:bg-black/5 hover:text-black disabled:opacity-40"
            >
              + Attach
            </button>

            <button
              type="button"
              onClick={() =>
                onModeChange(
                  mode === "learn"
                    ? "explain"
                    : "learn"
                )
              }
              disabled={loading}
              className={`rounded-lg px-3 py-2 text-xs transition disabled:opacity-40 ${
                mode === "learn"
                  ? "bg-black/5 text-black"
                  : "text-black/50 hover:bg-black/5 hover:text-black"
              }`}
            >
              {modeLabels[mode]}
            </button>

          </div>

          <button
            type="submit"
            disabled={loading || !message.trim()}
            aria-label="Send message"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1f1f1f] text-lg font-semibold text-white shadow-sm transition hover:scale-105 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-20"
          >
            {loading ? "…" : "↑"}
          </button>

        </div>
      </div>
    </form>
  );
}

type MessageBubbleProps = {
  message: Message;
};

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex items-start gap-3 ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#1f1f1f] text-xs font-semibold text-white">
          P
        </div>
      )}

      <div
        className={`max-w-[85%] ${
          isUser
            ? "rounded-2xl rounded-tr-md bg-[#1f1f1f] px-4 py-3 text-white"
            : "pt-1"
        }`}
      >
        {!isUser && (
          <div className="mb-1 text-sm font-medium">
            Pranexa
          </div>
        )}

        <p
          className={`whitespace-pre-wrap text-sm leading-6 ${
            isUser ? "text-white" : "text-black/80"
          }`}
        >
          {message.content}
        </p>
      </div>
    </div>
  );
}

type CapabilityCardsProps = {
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
};

function CapabilityCards({
  mode,
  onModeChange,
}: CapabilityCardsProps) {
  return (
    <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">

      <button
        type="button"
        onClick={() => onModeChange("explain")}
        className={`rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
          mode === "explain"
            ? "border-black/15 shadow-sm"
            : "border-black/5 hover:border-black/10"
        }`}
      >
        <div className="mb-3 text-lg">✦</div>

        <div className="text-sm font-medium">
          Explain
        </div>

        <div className="mt-1 text-xs leading-5 text-black/45">
          Turn difficult concepts into clear explanations.
        </div>
      </button>

      <button
        type="button"
        onClick={() => onModeChange("learn")}
        className={`rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
          mode === "learn"
            ? "border-black/15 shadow-sm"
            : "border-black/5 hover:border-black/10"
        }`}
      >
        <div className="mb-3 text-lg">◎</div>

        <div className="text-sm font-medium">
          Learn
        </div>

        <div className="mt-1 text-xs leading-5 text-black/45">
          Learn step by step with an adaptive AI tutor.
        </div>
      </button>

      <button
        type="button"
        onClick={() => onModeChange("solve")}
        className={`rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
          mode === "solve"
            ? "border-black/15 shadow-sm"
            : "border-black/5 hover:border-black/10"
        }`}
      >
        <div className="mb-3 text-lg">⌁</div>

        <div className="text-sm font-medium">
          Solve
        </div>

        <div className="mt-1 text-xs leading-5 text-black/45">
          Work through problems and understand the solution.
        </div>
      </button>

    </div>
  );
}