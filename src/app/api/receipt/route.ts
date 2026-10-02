import { NextRequest, NextResponse } from "next/server";
import { askGemini, GEMINI_KEY } from "@/lib/gemini";

/**
 * Reads a photo of a grocery bill and returns its lines.
 *
 * The model's whole job is transcription: what was bought, how much of it, and
 * what it cost. It is explicitly not asked to work out a price per 100 g — the
 * app does that from the numbers it returns, so a misread multiplication can't
 * quietly become the price of your food.
 *
 * The photo is forwarded and forgotten. Nothing is written down here.
 */

const MAX_IMAGE = 4 * 1024 * 1024; // a shrunk phone photo is ~200 KB; this is generous
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
    shop: { type: "STRING", description: "The shop's name, if it's printed." },
    date: { type: "STRING", description: "The bill's date as printed, or empty." },
    lines: {
      type: "ARRAY",
      description: "One entry per item on the bill. Skip totals, taxes, discounts and anything that isn't a thing bought.",
      items: {
        type: "OBJECT",
        properties: {
          text: { type: "STRING", description: "The line exactly as printed, so a person can check it." },
          item: { type: "STRING", description: "Just the item's name, without quantity or price." },
          qty: { type: "NUMBER", description: "How much was bought, as a number. A 500g pack bought twice is 1000 with unit g." },
          unit: { type: "STRING", description: "g, kg, ml, l, piece or dozen. Use piece when the bill counts items." },
          amount: { type: "NUMBER", description: "What this line cost in rupees, after any line discount." },
        },
        required: ["text", "item", "qty", "unit", "amount"],
      },
    },
  },
  required: ["lines"],
};

const SYSTEM = `You read photographs of grocery bills from India and return what is on them. Nothing else.

- Transcribe, don't calculate. Give the quantity and the amount as printed; the app works out any price per unit itself.
- One entry per item bought. Leave out subtotals, totals, GST, rounding, discounts applied to the whole bill, and anything that isn't food or a supplement.
- If a line is for several packs, give the total quantity: two 500 g packs is qty 1000, unit g.
- Loose produce is usually priced per kg with the weight printed; give the weight bought and what it cost.
- Use only these units: g, kg, ml, l, piece, dozen. If the quantity is unreadable, give 0 — do not estimate it.
- If you cannot read the image, or it isn't a bill, return an empty list of lines.
- Never invent an item, a quantity or a price. A bill you half-read is worse than one you admit you couldn't.`;

type Body = { image?: unknown; mime?: unknown };

export async function POST(req: NextRequest) {
  if (!GEMINI_KEY) {
    return NextResponse.json({ error: "Reading bills isn't set up on this server. It needs a GEMINI_API_KEY." }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const image = typeof body.image === "string" ? body.image : "";
  const mime = typeof body.mime === "string" && /^image\/(jpeg|png|webp)$/.test(body.mime) ? body.mime : "";
  if (!image || !mime) {
    return NextResponse.json({ error: "Send a JPEG, PNG or WebP photo of the bill." }, { status: 400 });
  }
  if (image.length > MAX_IMAGE) {
    return NextResponse.json({ error: "That photo is too big. Try again — the app normally shrinks it first." }, { status: 413 });
  }
  if (limited()) {
    return NextResponse.json({ error: "One bill at a time — try again in a few seconds." }, { status: 429 });
  }

  const asked = await askGemini({
    system: SYSTEM,
    parts: [
      { text: "Read this bill." },
      { inlineData: { mimeType: mime, data: image } },
    ],
    schema: SCHEMA,
    temperature: 0,
    maxOutputTokens: 2048,
  });

  if (!asked.ok) return NextResponse.json({ error: asked.error }, { status: asked.status });

  const data = asked.data as { lines?: unknown };
  if (!data || typeof data !== "object" || !Array.isArray(data.lines)) {
    return NextResponse.json({ error: "That didn't come back as a readable bill. Try a clearer photo." }, { status: 502 });
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
