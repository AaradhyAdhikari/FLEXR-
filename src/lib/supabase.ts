"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * The project URL, however it was pasted in.
 *
 * Supabase's dashboard shows several URLs and it's easy to copy the REST one,
 * `https://<project>.supabase.co/rest/v1`. The client wants the bare project
 * URL and silently builds nonsense paths from anything else — auth lands on
 * `/rest/v1/auth/v1/otp` and answers "Invalid path specified in request URL",
 * which looks like a dozen other problems. One line here is cheaper than
 * anyone ever debugging that again.
 */
export function projectUrl(raw: string): string {
  const trimmed = (raw || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  try {
    const u = new URL(trimmed);
    return u.origin; // everything after the host is a path we don't want
  } catch {
    // Not a URL at all: hand it back and let createClient complain plainly.
    return trimmed;
  }
}

const url = projectUrl(process.env.SUPABASE_URL || "");
const key = (process.env.SUPABASE_ANON_KEY || "").trim();

/**
 * True when the Supabase keys are configured (on Vercel, or in .env.local).
 * Without them Flexr falls back to "local mode": the old sign-in and browser-only storage.
 */
export const cloudEnabled = Boolean(url && key);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!cloudEnabled) throw new Error("Supabase is not configured");
  if (!client) {
    client = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // picks up the session when the user clicks the email link
        flowType: "implicit",
      },
    });
  }
  return client;
}
