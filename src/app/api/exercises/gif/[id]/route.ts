import { NextRequest, NextResponse } from "next/server";

/**
 * Serves a WorkoutX animation for one exercise.
 *
 * WorkoutX requires its key on every request, including the GIF files, so the
 * browser can't load them directly — they come through here instead. The key
 * stays on the server, and answers are cached hard at the edge (the animations
 * never change) so the monthly request allowance is spent once per exercise.
 */
const WX_URL = process.env.WORKOUTX_URL || "https://api.workoutxapp.com"; // override only for tests
const KEY = process.env.WORKOUTX_API_KEY || "";
const YEAR = 60 * 60 * 24 * 365;

// Belt and braces: a burst of misses shouldn't burn the monthly allowance.
const hits: number[] = [];
function limited(): boolean {
  const now = Date.now();
  while (hits.length && now - hits[0] > 60_000) hits.shift();
  if (hits.length >= 20) return true;
  hits.push(now);
  return false;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d{3,5}$/.test(id)) return NextResponse.json({ error: "Bad exercise id" }, { status: 400 });
  if (!KEY) return NextResponse.json({ error: "Animations aren't set up on this server." }, { status: 503 });
  if (limited()) return NextResponse.json({ error: "Too many animation requests. Try again shortly." }, { status: 429 });

  try {
    const res = await fetch(`${WX_URL}/v1/gifs/${id}.gif`, {
      headers: { "X-WorkoutX-Key": KEY, Accept: "image/gif" },
      next: { revalidate: YEAR },
    });
    if (res.status === 404) return NextResponse.json({ error: "No animation for that exercise." }, { status: 404 });
    if (res.status === 429) return NextResponse.json({ error: "Animation limit reached for now." }, { status: 429 });
    if (!res.ok) return NextResponse.json({ error: "Couldn't fetch the animation." }, { status: 502 });
    const body = await res.arrayBuffer();
    return new NextResponse(body, {
      headers: {
        "Content-Type": "image/gif",
        // Immutable: an exercise's animation is always the same file.
        "Cache-Control": "public, max-age=604800, s-maxage=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Couldn't reach the animation service." }, { status: 502 });
  }
}
