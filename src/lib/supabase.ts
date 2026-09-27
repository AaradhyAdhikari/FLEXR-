"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || "";
const key = process.env.SUPABASE_ANON_KEY || "";

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
