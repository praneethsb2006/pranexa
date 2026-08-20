"use client";

import { useState } from "react";

export default function Home() {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const userMessage = message.trim();

    if (!userMessage || loading) {
      return;
    }

    setLoading(true);
    setResponse("");

    try {
      const apiResponse = await fetch(
        "http://127.0.0.1:8000/api/v1/chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: userMessage,
            mode: "explain",
          }),
        }
      );

      if (!apiResponse.ok) {
        throw new Error("Backend request failed");
      }

      const data = await apiResponse.json();

      setResponse(data.response);
      setMessage("");
    } catch (error) {
      console.error("Pranexa error:", error);

      setResponse(
        "Sorry, Pranexa could not connect to the backend."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#1f1f1f]">
      <div className="flex min-h-screen">

        {/* Sidebar */}
        <aside className="hidden w-[260px] flex-col border-r border-black/5 bg-[#efefec] px-4 py-5 md:flex">

          <div className="mb-8 flex items-center gap-2 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1f1f1f] text-sm font-semibold text-white">
              P
            </div>

            <span className="text-lg font-semibold tracking-tight">
              Pranexa
            </span>
          </div>

          <button
            type="button"
            className="mb-7 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-black/5"
          >
            <span className="text-lg">+</span>
            New chat
          </button>

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
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition hover:bg-black/5"
            >
              <span>✦</span>
              Learn
            </button>
          </nav>

          <div className="mt-8 px-3 text-xs font-medium uppercase tracking-wider text-black/40">
            Recent
          </div>

          <div className="mt-3 px-3 text-sm text-black/40">
            No conversations yet
          </div>

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

        {/* Main */}
        <section className="flex min-h-screen flex-1 flex-col">

          {/* Header */}
          <header className="flex h-16 items-center justify-between border-b border-black/5 px-5 md:px-8">

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

          {/* Content */}
          <div className="flex flex-1 items-center justify-center px-5 py-12">

            <div className="w-full max-w-3xl">

              {/* Heading */}
              <div className="mb-8 text-center">

                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1f1f1f] text-xl font-semibold text-white shadow-sm">
                  P
                </div>

                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  What do you want to understand?
                </h1>

                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-black/50 sm:text-base">
                  Ask Pranexa anything. Learn complex topics,
                  solve problems, understand documents, and build
                  your knowledge step by step.
                </p>

              </div>

              {/* Chat Input */}
              <form onSubmit={handleSubmit}>

                <div className="rounded-2xl border border-black/10 bg-white p-2 shadow-sm transition focus-within:border-black/20 focus-within:shadow-md">

                  <textarea
                    value={message}
                    onChange={(event) => {
                      setMessage(event.target.value);
                    }}
                    placeholder="Ask anything..."
                    rows={3}
                    disabled={loading}
                    className="w-full resize-none border-none bg-transparent px-4 py-3 text-sm outline-none placeholder:text-black/35 disabled:opacity-50"
                  />

                  <div className="flex items-center justify-between px-2 pb-1">

                    <div className="flex items-center gap-1">

                      <button
                        type="button"
                        className="rounded-lg px-3 py-2 text-xs text-black/50 transition hover:bg-black/5 hover:text-black"
                      >
                        + Attach
                      </button>

                      <button
                        type="button"
                        className="rounded-lg px-3 py-2 text-xs text-black/50 transition hover:bg-black/5 hover:text-black"
                      >
                        Learn mode
                      </button>

                    </div>

                    {/* SEND BUTTON */}
                    <button
                      type="submit"
                      disabled={loading}
                      aria-label="Send message"
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1f1f1f] text-lg font-semibold text-white shadow-sm transition hover:scale-105 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {loading ? "..." : "↑"}
                    </button>

                  </div>
                </div>

              </form>

              {/* Response */}
              {(response || loading) && (
                <div className="mt-5 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">

                  <div className="mb-3 flex items-center gap-2">

                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1f1f1f] text-xs font-semibold text-white">
                      P
                    </div>

                    <span className="text-sm font-medium">
                      Pranexa
                    </span>

                  </div>

                  {loading ? (
                    <p className="text-sm text-black/50">
                      Thinking...
                    </p>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-6 text-black/80">
                      {response}
                    </p>
                  )}

                </div>
              )}

              {/* Capabilities */}
              <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">

                <button
                  type="button"
                  className="rounded-2xl border border-black/5 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-black/10 hover:shadow-sm"
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
                  className="rounded-2xl border border-black/5 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-black/10 hover:shadow-sm"
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
                  className="rounded-2xl border border-black/5 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-black/10 hover:shadow-sm"
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

              {/* Disclaimer */}
              <p className="mt-8 text-center text-xs text-black/30">
                Pranexa can make mistakes. Always verify important information.
              </p>

            </div>
          </div>
        </section>
      </div>
    </main>
  );
}