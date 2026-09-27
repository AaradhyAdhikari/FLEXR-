import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Expose the Supabase project URL and public (anon/publishable) key to the browser.
  // Both are designed to be public; data is protected by Row Level Security in the database.
  // USDA_API_KEY is deliberately NOT listed here, so it stays server-only.
  env: {
    SUPABASE_URL: process.env.SUPABASE_URL ?? "",
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? "",
  },
};

export default nextConfig;
