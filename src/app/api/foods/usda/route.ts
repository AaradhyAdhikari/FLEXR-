import { NextRequest, NextResponse } from "next/server";
import { parseFdcSearch } from "@/lib/usda";

// Server-only: USDA_API_KEY never reaches the browser.
const FDC_URL = process.env.USDA_FDC_URL || "https://api.nal.usda.gov/fdc/v1/foods/search"; // override only for tests

// Light per-instance rate limit so a single visitor can't burn the shared 1,000 requests/hour key.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();

function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2 || q.length > 60) {
    return NextResponse.json({ error: "Search for 2–60 characters." }, { status: 400 });
  }
  const key = process.env.USDA_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "USDA search isn't set up on this server." }, { status: 503 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limited(ip)) {
    return NextResponse.json({ error: "Too many searches. Try again in a minute." }, { status: 429 });
  }

  const url = new URL(FDC_URL);
  url.searchParams.set("api_key", key);
  url.searchParams.set("query", q);
  url.searchParams.set("dataType", "Foundation,SR Legacy"); // whole foods only, values per 100 g
  url.searchParams.set("pageSize", "25");

  try {
    // Identical searches are cached for a day, which also saves quota.
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (res.status === 429) {
      return NextResponse.json({ error: "USDA search is busy right now. Try again later." }, { status: 503 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: "USDA search failed." }, { status: 502 });
    }
    const foods = parseFdcSearch(await res.json());
    return NextResponse.json(
      { foods },
      { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } }
    );
  } catch {
    return NextResponse.json({ error: "Couldn't reach USDA." }, { status: 502 });
  }
}
