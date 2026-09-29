import { NextRequest, NextResponse } from "next/server";
import { bestMatch, exerciseDbGif, tokens } from "@/lib/animSource";

/**
 * The animation for one of our exercises.
 *
 * Tries ExerciseDB first — same artwork, no watermark — and only trusts a
 * result whose name is really the same exercise. Otherwise it hands back the
 * WorkoutX animation, which is watermarked but always the right movement.
 *
 * Answers are cached for a year at the edge, so each exercise is looked up once.
 */
const EDB_URL = process.env.EXERCISEDB_URL || "https://oss.exercisedb.dev"; // override only for tests
const EDB_MEDIA = process.env.EXERCISEDB_MEDIA_URL || "https://static.exercisedb.dev";
const YEAR = 60 * 60 * 24 * 365;

type EdbExercise = { exerciseId?: string; name?: string };

/**
 * The two catalogues spell things differently — "Pushups" against "push-up" —
 * so a few spellings are tried before giving up.
 */
function queries(name: string): string[] {
  const t = tokens(name);
  const spaced = t.join(" ");
  const hyphened = t.join("-");
  return [...new Set([name.toLowerCase(), spaced, hyphened].filter(Boolean))];
}

async function fromExerciseDb(name: string): Promise<string | null> {
  for (const q of queries(name)) {
    try {
      const res = await fetch(`${EDB_URL}/api/v1/exercises?limit=8&name=${encodeURIComponent(q)}`, {
        headers: { Accept: "application/json" },
        next: { revalidate: YEAR },
      });
      if (!res.ok) return null; // rate limited or down: the fallback covers it
      const body = (await res.json()) as { data?: EdbExercise[] };
      const hit = bestMatch(name, (body.data ?? []).filter((e) => e.exerciseId));
      if (hit?.exerciseId) return hit.exerciseId;
    } catch {
      return null;
    }
  }
  return null;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const name = req.nextUrl.searchParams.get("name") ?? "";
  const workoutx = req.nextUrl.searchParams.get("wx") ?? "";
  if (!/^[\w.-]{1,80}$/.test(id)) return NextResponse.json({ error: "Bad exercise id" }, { status: 400 });

  const clean = name ? await fromExerciseDb(name) : null;
  if (clean) {
    return NextResponse.redirect(exerciseDbGif(clean, EDB_MEDIA), {
      status: 302,
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=31536000" },
    });
  }
  if (/^\d{3,5}$/.test(workoutx)) {
    return NextResponse.redirect(new URL(`/api/exercises/gif/${workoutx}`, req.nextUrl.origin), {
      status: 302,
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=2592000" },
    });
  }
  return NextResponse.json({ error: "No animation for that exercise." }, { status: 404 });
}
