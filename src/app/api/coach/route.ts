import { NextRequest, NextResponse } from "next/server";

/**
 * The coach: asks Gemini a question about your own training and food data.
 *
 * The key lives here and never reaches the browser. The answer comes back as
 * JSON in a fixed shape so the app can check its arithmetic before you see it —
 * the model suggests food and sessions, the app works out what they actually add
 * up to. Nothing here is stored: the request is forwarded and forgotten.
 */

const URL_BASE = process.env.GEMINI_URL || "https://generativelanguage.googleapis.com";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const KEY = process.env.GEMINI_API_KEY || "";

// A free tier is a small tier. Two limiters: a burst, and a rough daily cap.
const minute: number[] = [];
const today: { day: string; count: number } = { day: "", count: 0 };
// Defaults suit a free key. Raise them if you pay for a bigger allowance.
const PER_MINUTE = Number(process.env.GEMINI_PER_MINUTE) || 6;
const PER_DAY = Number(process.env.GEMINI_PER_DAY) || 80;

function limited(): "burst" | "day" | null {
  const now = Date.now();
  while (minute.length && now - minute[0] > 60_000) minute.shift();
  if (minute.length >= PER_MINUTE) return "burst";
  const day = new Date().toISOString().slice(0, 10);
  if (today.day !== day) {
    today.day = day;
    today.count = 0;
  }
  if (today.count >= PER_DAY) return "day";
  minute.push(now);
  today.count++;
  return null;
}

/**
 * The shape the model must answer in. Food names have to be ones the app sent,
 * so a suggestion can be priced and counted rather than admired.
 */
const SCHEMA = {
  type: "OBJECT",
  properties: {
    reply: { type: "STRING", description: "The answer, in plain language. Two short paragraphs at most." },
    diet: {
      type: "OBJECT",
      description: "Only when a day's food is being proposed.",
      properties: {
        note: { type: "STRING" },
        meals: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING" },
              items: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    food: { type: "STRING", description: "Exactly one of the food names given in the context." },
                    qty: { type: "NUMBER", description: "Amount in that food's own unit." },
                  },
                  required: ["food", "qty"],
                },
              },
            },
            required: ["name", "items"],
          },
        },
      },
      required: ["meals"],
    },
    workout: {
      type: "OBJECT",
      description: "Only when training is being proposed.",
      properties: {
        note: { type: "STRING" },
        days: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING" },
              exercises: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    name: { type: "STRING" },
                    sets: { type: "NUMBER" },
                    reps: { type: "STRING" },
                  },
                  required: ["name", "sets", "reps"],
                },
              },
            },
            required: ["name", "exercises"],
          },
        },
      },
      required: ["days"],
    },
  },
  required: ["reply"],
};

const SYSTEM = `You are the coach inside Flexr, a training and food tracker. You are talking to the person whose data follows.

Rules you do not break:
- Work only from the numbers you are given. If something isn't there, say what you'd need rather than assuming it.
- Never do arithmetic the app can do. Propose foods and quantities; the app computes the calories, protein and cost and shows them. Do not state totals you worked out yourself.
- Only use food names exactly as given in "foods". If the person needs something they haven't got, say so in the reply instead of inventing a food.
- Respect the budget when one is given. Cheap is not the goal; value is.
- You are not a doctor. No diagnosing, no supplements beyond ordinary food and protein powder, no medical advice. If someone describes pain, illness, disordered eating, or wants to eat very little, say plainly that it's outside what you can help with and suggest a professional.
- Never propose a day under 1200 kcal, and never a deficit steeper than about 20% under their target. If they ask for one, refuse that part and explain why in one sentence.
- Be brief and specific. No preamble, no motivational filler, no emoji. Say the thing.
- Where their own logged data contradicts what they're asking for, point at it.`;


/**
 * Which model to call.
 *
 * Model names come and go, and a key is only entitled to some of them, so a
 * hard-coded name is a time bomb. The configured one is tried first; if Gemini
 * says it doesn't exist, the account's own model list decides, and the answer is
 * remembered for the life of the server process.
 */
let resolved: string | null = null;

/** Google's error text, trimmed to something safe and short to show a human. */
async function upstreamError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string; status?: string } };
    const msg = body?.error?.message ?? "";
    // Never echo anything that could carry the key back to the browser.
    return msg.replace(/key=[\w-]+/gi, "key=…").slice(0, 200);
  } catch {
    return "";
  }
}

/** Models this key can actually use for generateContent, best guess first. */
export async function usableModels(): Promise<string[]> {
  const res = await fetch(`${URL_BASE}/v1beta/models`, {
    headers: { "x-goog-api-key": KEY },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
  const names = (data.models ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((m) => (m.name ?? "").replace(/^models\//, ""))
    .filter(Boolean);
  // Prefer a current flash model: fast and the cheapest thing that does this job.
  const score = (n: string) =>
    (/flash/.test(n) ? 0 : /pro/.test(n) ? 1 : 2) +
    (/preview|exp|thinking|tts|image|embedding|vision/.test(n) ? 4 : 0);
  return names.sort((a, b) => score(a) - score(b) || b.localeCompare(a));
}

type Body = { question?: unknown; context?: unknown };


/**
 * What the coach is working with. No secrets: whether a key is set, which model
 * is configured, and which models that key can actually use — enough to tell a
 * missing key from a wrong model name without reading server logs.
 */
export async function GET() {
  if (!KEY) {
    return NextResponse.json({ keySet: false, model: MODEL, models: [], note: "No GEMINI_API_KEY on this server." });
  }
  try {
    const models = await usableModels();
    return NextResponse.json({
      keySet: true,
      model: resolved ?? MODEL,
      configured: MODEL,
      usable: models.slice(0, 20),
      note: models.length
        ? models.includes(MODEL)
          ? "The configured model is available."
          : `The configured model is not in this key's list; "${models[0]}" would be used instead.`
        : "The key is set but Gemini listed no usable models for it.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ keySet: true, model: MODEL, usable: [], note: "Couldn't reach Gemini to list models." }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  if (!KEY) {
    return NextResponse.json(
      { error: "The coach isn't set up on this server. Add a GEMINI_API_KEY and redeploy." },
      { status: 503 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question || question.length > 1000) {
    return NextResponse.json({ error: "Ask a question, up to 1000 characters." }, { status: 400 });
  }
  if (!body.context || typeof body.context !== "object") {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const context = JSON.stringify(body.context);
  if (context.length > 60_000) {
    return NextResponse.json({ error: "That's more data than the coach can read at once." }, { status: 413 });
  }

  const hit = limited();
  if (hit === "burst") return NextResponse.json({ error: "One at a time — try again in a few seconds." }, { status: 429 });
  if (hit === "day") return NextResponse.json({ error: "The coach has hit its limit for today. It resets tomorrow." }, { status: 429 });

  const ask = (model: string) =>
    fetch(`${URL_BASE}/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: `Here is my data:\n${context}\n\nMy question: ${question}` }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
          temperature: 0.4,
          maxOutputTokens: 2048,
        },
      }),
      cache: "no-store",
    });

  try {
    let model = resolved ?? MODEL;
    let res = await ask(model);

    // "No such model" is worth one retry against whatever this key can use.
    if ((res.status === 404 || res.status === 400) && !resolved) {
      const options = await usableModels();
      const next = options.find((m) => m !== model);
      if (next) {
        res = await ask(next);
        if (res.ok) {
          resolved = next;
          model = next;
        }
      }
    }

    if (res.status === 429) {
      // Gemini's quotas are per model as well as per key, so the message matters:
      // "this model has no free tier" and "you've asked too often" both land here.
      const why = await upstreamError(res);
      return NextResponse.json(
        { error: `Gemini turned the request down on quota for "${model}".${why ? ` Google said: ${why}` : ""}` },
        { status: 429 }
      );
    }
    if (res.status === 401 || res.status === 403) {
      const why = await upstreamError(res);
      return NextResponse.json({ error: `The coach's key was refused. Check GEMINI_API_KEY.${why ? ` Google said: ${why}` : ""}` }, { status: 502 });
    }
    if (!res.ok) {
      const why = await upstreamError(res);
      return NextResponse.json(
        { error: `The coach couldn't answer (model "${model}", HTTP ${res.status}).${why ? ` Google said: ${why}` : ""}` },
        { status: 502 }
      );
    }
    if (res.ok && !resolved) resolved = model;

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
    };

    if (data.promptFeedback?.blockReason) {
      return NextResponse.json({ error: "The coach declined to answer that one." }, { status: 422 });
    }
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text.trim()) {
      const why = data.candidates?.[0]?.finishReason;
      return NextResponse.json(
        { error: why === "MAX_TOKENS" ? "The answer ran long and got cut off. Ask for something narrower." : "The coach came back empty." },
        { status: 502 }
      );
    }

    let answer: unknown;
    try {
      answer = JSON.parse(text);
    } catch {
      // The schema should prevent this, but a malformed answer is not something
      // to hand on to the app as if it were data.
      return NextResponse.json({ error: "The coach's answer didn't make sense. Try asking again." }, { status: 502 });
    }
    if (!answer || typeof answer !== "object" || typeof (answer as { reply?: unknown }).reply !== "string") {
      return NextResponse.json({ error: "The coach's answer didn't make sense. Try asking again." }, { status: 502 });
    }

    return NextResponse.json(answer, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Couldn't reach the coach." }, { status: 502 });
  }
}
