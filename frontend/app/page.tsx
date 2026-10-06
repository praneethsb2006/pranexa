"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Session } from "@supabase/supabase-js";
import AuthForm from "@/components/AuthForm";
import { authenticatedFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";

type ChatMode = "explain" | "learn" | "solve";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ChatResponse = {
  response?: string;
  mode?: string;
  conversation_id?: string;
};

type Conversation = {
  id: string;
  title: string;
  created_at: string;
};
const API_URL = "http://127.0.0.1:8000/chat";

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
  const [sessionLoading, setSessionLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  // ---------------------------------------------------------
  // Conversation ID
  // ---------------------------------------------------------
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [conversationMessagesLoading, setConversationMessagesLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const initializeSession = async () => {
      const {
        data: { session: activeSession },
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      setSession(activeSession);
      setSessionLoading(false);
    };

    void initializeSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession);
      setConversations([]);
      setConversationsLoading(false);
      setSessionLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    const loadConversations = async () => {
      setConversationsLoading(true);

      try {
        const response = await authenticatedFetch(
          "http://127.0.0.1:8000/conversations"
        );

        if (!response.ok) {
          throw new Error("Failed to load conversations");
        }

        const data = await response.json();

        setConversations(data.conversations ?? []);
      } catch (error) {
        console.error("Failed to load conversations:", error);
      } finally {
        setConversationsLoading(false);
      }
    };

    void loadConversations();
  }, [session]);

  const loadConversation = async (selectedConversationId: string) => {
    if (loading || conversationMessagesLoading) {
      return;
    }

    setConversationMessagesLoading(true);
    setConversationId(selectedConversationId);

    try {
      const response = await authenticatedFetch(
        `http://127.0.0.1:8000/conversations/${selectedConversationId}/messages`
      );

      if (!response.ok) {
        throw new Error(
          `Failed to load conversation (${response.status})`
        );
      }

      const data = await response.json();

      const loadedMessages: Message[] = (data.messages ?? []).map(
        (item: {
          id: string;
          role: "user" | "assistant";
          content: string;
        }) => ({
          id: item.id,
          role: item.role,
          content: item.content,
        })
      );

      setMessages(loadedMessages);
      setMessage("");
    } catch (error) {
      console.error("Failed to load conversation:", error);
    } finally {
      setConversationMessagesLoading(false);
    }
  };

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
      const apiResponse = await authenticatedFetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          mode,
          conversation_id: conversationId,
        }),
      });

      if (!apiResponse.ok) {
        throw new Error(
          `Backend returned status ${apiResponse.status}`
        );
      }

      const data: ChatResponse = await apiResponse.json();

      // -----------------------------------------------------
      // Save the conversation ID returned by the backend
      // -----------------------------------------------------

      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }

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

    // IMPORTANT:
    // A new chat must get a new conversation.
    setConversationId(null);

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

  if (sessionLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f5] px-5 py-12 text-[#1f1f1f]">
        <div className="text-sm font-medium text-black/55">
          Loading Pranexa...
        </div>
      </main>
    );
  }

  if (!session) {
    return <AuthForm />;
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#1f1f1f]">
      <div className="flex min-h-screen">

        {/* SIDEBAR */}
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
              <span>□</span>
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

          <div className="mt-3 space-y-1">
            {conversationsLoading ? (
              <div className="px-3 py-2 text-sm text-black/40">
                Loading conversations...
              </div>
            ) : conversations.length === 0 ? (
              <div className="px-3 py-2 text-sm text-black/40">
                No conversations yet
              </div>
            ) : (
              conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                    conversationId === conversation.id
                      ? "bg-black/5 text-black"
                      : "text-black/65 hover:bg-black/5"
                  }`}
                  onClick={() => {
                    void loadConversation(conversation.id);
                  }}
                >
                  <div className="truncate">
                    {conversation.title || "Untitled conversation"}
                  </div>
                </button>
              ))
            )}
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

        {/* MAIN CONTENT */}
        <section className="flex min-h-screen min-w-0 flex-1 flex-col">

          {/* HEADER */}
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

          {/* CHAT */}
          <div className="flex min-h-0 flex-1 flex-col">

            {!hasMessages && !conversationMessagesLoading ? (

              /* EMPTY STATE */
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

            ) : conversationMessagesLoading && messages.length === 0 ? (

              <div className="flex flex-1 items-center justify-center px-5 py-12">
                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#1f1f1f] text-sm font-semibold text-white">
                    P
                  </div>
                  <p className="text-sm text-black/50">
                    Loading conversation...
                  </p>
                </div>
              </div>

            ) : (

              /* CONVERSATION */
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

                            <span className="animate-pulse">
                              •
                            </span>

                            <span
                              className="animate-pulse"
                              style={{
                                animationDelay: "150ms",
                              }}
                            >
                              •
                            </span>

                            <span
                              className="animate-pulse"
                              style={{
                                animationDelay: "300ms",
                              }}
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

                {/* COMPOSER */}
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


/* ============================================================
   CHAT COMPOSER
============================================================ */

type ChatComposerProps = {
  message: string;
  setMessage: (value: string) => void;
  loading: boolean;
  mode: ChatMode;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onSubmit: (
    event?: React.FormEvent<HTMLFormElement>
  ) => void | Promise<void>;
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
    <form
      onSubmit={(event) => {
        void onSubmit(event);
      }}
    >

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

          {/* SEND BUTTON */}
          <button
            type="submit"
            disabled={loading || !message.trim()}
            aria-label="Send message"
            title="Send message"
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[#1f1f1f] text-lg font-semibold text-white shadow-sm transition hover:scale-105 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-20"
          >
            {loading ? "…" : "↑"}
          </button>

        </div>

      </div>

    </form>
  );
}


/* ============================================================
   MESSAGE BUBBLE
============================================================ */

type MessageBubbleProps = {
  message: Message;
};

function MessageBubble({
  message,
}: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex items-start gap-3 ${
        isUser
          ? "justify-end"
          : "justify-start"
      }`}
    >

      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#1f1f1f] text-xs font-semibold text-white">
          P
        </div>
      )}

      <div
        className={`max-w-[90%] ${
          isUser
            ? "rounded-2xl rounded-tr-md bg-[#1f1f1f] px-4 py-3 text-white"
            : "min-w-0 pt-1"
        }`}
      >

        {!isUser && (
          <div className="mb-2 text-sm font-medium">
            Pranexa
          </div>
        )}

        {isUser ? (

          <p className="whitespace-pre-wrap text-sm leading-6 text-white">
            {message.content}
          </p>

        ) : (

          <div className="max-w-none text-black/80">

            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{

                h1: ({ children }) => (
                  <h1 className="mb-4 mt-6 text-2xl font-semibold tracking-tight first:mt-0">
                    {children}
                  </h1>
                ),

                h2: ({ children }) => (
                  <h2 className="mb-3 mt-6 text-xl font-semibold tracking-tight first:mt-0">
                    {children}
                  </h2>
                ),

                h3: ({ children }) => (
                  <h3 className="mb-2 mt-5 text-lg font-semibold">
                    {children}
                  </h3>
                ),

                p: ({ children }) => (
                  <p className="mb-4 text-sm leading-7 text-black/75">
                    {children}
                  </p>
                ),

                ul: ({ children }) => (
                  <ul className="mb-4 ml-5 list-disc space-y-1 text-sm leading-6">
                    {children}
                  </ul>
                ),

                ol: ({ children }) => (
                  <ol className="mb-4 ml-5 list-decimal space-y-1 text-sm leading-6">
                    {children}
                  </ol>
                ),

                li: ({ children }) => (
                  <li className="pl-1">
                    {children}
                  </li>
                ),

                strong: ({ children }) => (
                  <strong className="font-semibold text-black">
                    {children}
                  </strong>
                ),

                blockquote: ({ children }) => (
                  <blockquote className="my-4 border-l-4 border-black/15 pl-4 italic text-black/60">
                    {children}
                  </blockquote>
                ),

                hr: () => (
                  <hr className="my-6 border-black/10" />
                ),

                code: ({
                  className,
                  children,
                  ...props
                }) => {
                  const isBlock = Boolean(className);

                  if (!isBlock) {
                    return (
                      <code
                        className="rounded-md bg-black/5 px-1.5 py-0.5 font-mono text-[0.9em] text-black/80"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }

                  return (
                    <code
                      className={`${className ?? ""} block overflow-x-auto font-mono text-[13px] leading-6`}
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },

                pre: ({ children }) => (
                  <pre className="my-5 overflow-x-auto rounded-xl bg-[#1f1f1f] p-4 text-white shadow-sm">
                    {children}
                  </pre>
                ),

                a: ({ children, href }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:opacity-70"
                  >
                    {children}
                  </a>
                ),

                table: ({ children }) => (
                  <div className="my-5 overflow-x-auto rounded-xl border border-black/10">
                    <table className="w-full border-collapse text-sm">
                      {children}
                    </table>
                  </div>
                ),

                th: ({ children }) => (
                  <th className="border-b border-black/10 bg-black/[0.03] px-3 py-2 text-left font-semibold">
                    {children}
                  </th>
                ),

                td: ({ children }) => (
                  <td className="border-b border-black/5 px-3 py-2">
                    {children}
                  </td>
                ),

              }}
            >
              {message.content}
            </ReactMarkdown>

          </div>

        )}

      </div>

    </div>
  );
}


/* ============================================================
   CAPABILITY CARDS
============================================================ */

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

      {/* EXPLAIN */}
      <button
        type="button"
        onClick={() => onModeChange("explain")}
        className={`rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
          mode === "explain"
            ? "border-black/15 shadow-sm"
            : "border-black/5 hover:border-black/10"
        }`}
      >

        <div className="mb-3 text-lg">
          ✦
        </div>

        <div className="text-sm font-medium">
          Explain
        </div>

        <div className="mt-1 text-xs leading-5 text-black/45">
          Turn difficult concepts into clear explanations.
        </div>

      </button>


      {/* LEARN */}
      <button
        type="button"
        onClick={() => onModeChange("learn")}
        className={`rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
          mode === "learn"
            ? "border-black/15 shadow-sm"
            : "border-black/5 hover:border-black/10"
        }`}
      >

        <div className="mb-3 text-lg">
          ◇
        </div>

        <div className="text-sm font-medium">
          Learn
        </div>

        <div className="mt-1 text-xs leading-5 text-black/45">
          Learn step by step with an adaptive AI tutor.
        </div>

      </button>


      {/* SOLVE */}
      <button
        type="button"
        onClick={() => onModeChange("solve")}
        className={`rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
          mode === "solve"
            ? "border-black/15 shadow-sm"
            : "border-black/5 hover:border-black/10"
        }`}
      >

        <div className="mb-3 text-lg">
          ⌘
        </div>

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