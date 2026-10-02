import { NextRequest, NextResponse } from "next/server";
import { askGemini, GEMINI_KEY } from "@/lib/gemini";

/**
 * Reads a sentence about a meal and returns only what was named and how much.
 *
 * "Butter paneer, about 200g, and two butter naan" comes back as two items with
 * quantities and units. No calories, no protein, no totals: the app looks those
 * up in its own dish data and does the arithmetic. A model that misremembers
 * how much protein is in paneer can't put a wrong number in your day.
 *
 * Nothing is stored. The sentence is forwarded and forgotten.
 */

const MAX_TEXT = 500;
const minute: number[] = [];
const PER_MINUTE = Number(process.env.GEMINI_PER_MINUTE) || 6;

function limited(): boolean {
  const now = Date.now();
  while (minute.length && now - minute[0] > 60_000) minute.shift();
  if (minute.length >= PER_MINUTE) return true;
  minute.push(now);
  return false;
}

const SCHEMA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      description: "One entry per distinct dish or drink mentioned.",
      items: {
        type: "OBJECT",
        properties: {
          item: { type: "STRING", description: "The dish on its own, no quantity. Keep the words used: 'butter paneer', 'butter naan', 'jeera rice'." },
          qty: { type: "NUMBER", description: "How much, as a number. 0 if no amount was given." },
          unit: { type: "STRING", description: "g, kg, ml, l, or a counting word: piece, plate, bowl, katori, naan, roti, glass, slice. Empty if none was said." },
        },
        required: ["item", "qty", "unit"],
      },
    },
  },
  required: ["items"],
};

const SYSTEM = `You read a sentence about a meal someone ate and list the dishes in it. Nothing else.

- Never give calories, protein, carbs, fat or any nutrition number. You are not asked for them and they will be ignored.
- One entry per dish. "Butter paneer and 2 butter naan" is two entries.
- Keep the dish's own words, minus the amount. Do not translate, expand or "correct" a name: 'butter paneer' stays 'butter paneer'.
- A weight or volume stays as said: "200g" is qty 200, unit g. "half a litre" is qty 0.5, unit l.
- A count keeps its counting word: "2 naan" is qty 2, unit naan; "a katori of dal" is qty 1, unit katori; "one plate rice" is qty 1, unit plate.
- Vague amounts — "some", "a bit of", "a little" — are qty 0 with an empty unit. Do not turn them into a number.
- Ignore anything that isn't food or drink, and ignore water.
- If the sentence names no food, return an empty list.
- Never add a dish that wasn't mentioned.`;

type Body = { text?: unknown };

export async function POST(req: NextRequest) {
  if (!GEMINI_KEY) {
    return NextResponse.json({ error: "Reading a meal in words isn't set up on this server. It needs a GEMINI_API_KEY." }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Say what you ate." }, { status: 400 });
  if (text.length > MAX_TEXT) {
    return NextResponse.json({ error: "That's a lot for one meal — keep it under 500 characters." }, { status: 413 });
  }
  if (limited()) {
    return NextResponse.json({ error: "One at a time — try again in a few seconds." }, { status: 429 });
  }

  const asked = await askGemini({
    system: SYSTEM,
    parts: [{ text }],
    schema: SCHEMA,
    temperature: 0,
    maxOutputTokens: 1024,
  });

  if (!asked.ok) return NextResponse.json({ error: asked.error }, { status: asked.status });

  const data = asked.data as { items?: unknown };
  if (!data || typeof data !== "object" || !Array.isArray(data.items)) {
    return NextResponse.json({ error: "That didn't come back readable. Try saying it more plainly." }, { status: 502 });
  }
  return NextResponse.json({ items: data.items }, { headers: { "Cache-Control": "no-store" } });
}
