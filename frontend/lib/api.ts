import { supabase } from "@/lib/supabase";

function isJsonBody(body: BodyInit | null | undefined): body is string {
  if (typeof body !== "string") {
    return false;
  }

  try {
    JSON.parse(body);
    return true;
  } catch {
    return false;
  }
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error("Unable to retrieve the authentication session.");
  }

  if (!session?.access_token) {
    throw new Error("Authentication required. Please sign in and try again.");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);

  if (!headers.has("Content-Type") && isJsonBody(init.body)) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
