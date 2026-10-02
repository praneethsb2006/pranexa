"use client";

import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

type AuthMode = "login" | "signup";

export default function AuthForm() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        setSuccessMessage("You are now logged in.");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        setSuccessMessage(
          data.session
            ? "Your account was created and you are now logged in."
            : "Your account was created. Check your email to confirm your account."
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Authentication failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const selectMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setErrorMessage("");
    setSuccessMessage("");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7f5] px-5 py-12 text-[#1f1f1f]">
      <section className="w-full max-w-md rounded-2xl border border-black/5 bg-white p-8 shadow-sm">
        <h1 className="text-center text-2xl font-semibold tracking-tight">
          Pranexa
        </h1>
        <p className="mt-2 text-center text-sm text-black/55">
          {mode === "login"
            ? "Log in to continue learning."
            : "Create an account to get started."}
        </p>

        <div className="mt-7 grid grid-cols-2 rounded-xl bg-[#f3f3f0] p-1">
          <button
            type="button"
            onClick={() => selectMode("login")}
            disabled={loading}
            aria-pressed={mode === "login"}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              mode === "login"
                ? "bg-white shadow-sm"
                : "text-black/55 hover:text-black"
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => selectMode("signup")}
            disabled={loading}
            aria-pressed={mode === "signup"}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              mode === "signup"
                ? "bg-white shadow-sm"
                : "text-black/55 hover:text-black"
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="auth-email" className="mb-1.5 block text-sm font-medium">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-black/35"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="mb-1.5 block text-sm font-medium">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-black/35"
            />
          </div>

          {errorMessage && (
            <p role="alert" className="text-sm text-red-700">
              {errorMessage}
            </p>
          )}
          {successMessage && (
            <p role="status" className="text-sm text-green-700">
              {successMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#1f1f1f] px-4 py-3 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? mode === "login"
                ? "Logging in..."
                : "Creating account..."
              : mode === "login"
                ? "Login"
                : "Sign Up"}
          </button>
        </form>
      </section>
    </main>
  );
}
