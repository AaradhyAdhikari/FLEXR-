/**
 * Talking to Gemini, server-side only.
 *
 * The key lives here and in the routes that import this — never in anything the
 * browser receives. Shared by the coach and the receipt reader so the awkward
 * parts (which model this key may use, what to say when it refuses) behave the
 * same in both and are fixed in one place.
 */

export const GEMINI_URL = process.env.GEMINI_URL || "https://generativelanguage.googleapis.com";
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
export const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

/** The model that has answered before, remembered for the life of the process. */
let resolved: string | null = null;
export const resolvedModel = (): string | null => resolved;

/** Google's error text, trimmed to something safe and short to show a human. */
export async function upstreamError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    const msg = body?.error?.message ?? "";
    // Never echo anything that could carry the key back to the browser.
    return msg.replace(/key=[\w-]+/gi, "key=…").slice(0, 200);
  } catch {
    return "";
  }
}

/** Models this key can actually use for generateContent, best guess first. */
export async function usableModels(): Promise<string[]> {
  const res = await fetch(`${GEMINI_URL}/v1beta/models`, {
    headers: { "x-goog-api-key": GEMINI_KEY },
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
    (/preview|exp|thinking|tts|embedding/.test(n) ? 4 : 0);
  return names.sort((a, b) => score(a) - score(b) || b.localeCompare(a));
}

export type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

export type Asked = {
  ok: true;
  /** Whatever the model answered, already parsed from its JSON. */
  data: unknown;
  model: string;
} | {
  ok: false;
  status: number;
  error: string;
};

/**
 * Ask a model for JSON in a fixed shape, and keep asking a different one while
 * the answer is "no such model" or "no quota" — a free allowance is granted per
 * model, so a neighbour may still answer. Once one works it's remembered.
 */
export async function askGemini(opts: {
  system: string;
  parts: Part[];
  schema: unknown;
  maxOutputTokens?: number;
  temperature?: number;
}): Promise<Asked> {
  if (!GEMINI_KEY) {
    return { ok: false, status: 503, error: "No GEMINI_API_KEY on this server." };
  }

  const call = (model: string) =>
    fetch(`${GEMINI_URL}/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: "user", parts: opts.parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: opts.schema,
          temperature: opts.temperature ?? 0.4,
          maxOutputTokens: opts.maxOutputTokens ?? 2048,
        },
      }),
      cache: "no-store",
    });

  let model = resolved ?? GEMINI_MODEL;
  let res = await call(model);
  const tried = [model];

  if (!resolved && (res.status === 404 || res.status === 400 || res.status === 429)) {
    const options = await usableModels();
    for (const next of options.filter((m) => !tried.includes(m)).slice(0, 2)) {
      tried.push(next);
      res = await call(next);
      model = next;
      if (res.ok) break;
    }
  }

  if (res.status === 429) {
    const why = await upstreamError(res);
    const which = tried.length > 1 ? `${tried.join(", ")} all have no quota` : `"${model}" has no quota`;
    return {
      ok: false,
      status: 429,
      error:
        `Gemini refused on quota: ${which}. ` +
        (tried.length > 1 ? "That usually means the key's Google project has no free-tier allowance, which is fixed in Google AI Studio rather than here. " : "") +
        (why ? `Google said: ${why}` : ""),
    };
  }
  if (res.status === 401 || res.status === 403) {
    const why = await upstreamError(res);
    return { ok: false, status: 502, error: `The key was refused. Check GEMINI_API_KEY.${why ? ` Google said: ${why}` : ""}` };
  }
  if (!res.ok) {
    const why = await upstreamError(res);
    return { ok: false, status: 502, error: `Gemini couldn't answer (tried ${tried.join(", ")}; HTTP ${res.status}).${why ? ` Google said: ${why}` : ""}` };
  }
  if (!resolved) resolved = model;

  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };
  if (body.promptFeedback?.blockReason) {
    return { ok: false, status: 422, error: "Gemini declined to answer that one." };
  }
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) {
    const why = body.candidates?.[0]?.finishReason;
    return {
      ok: false,
      status: 502,
      error: why === "MAX_TOKENS" ? "The answer ran long and got cut off. Try something smaller." : "Gemini came back empty.",
    };
  }
  try {
    return { ok: true, data: JSON.parse(text), model };
  } catch {
    return { ok: false, status: 502, error: "Gemini's answer didn't make sense. Try again." };
  }
}
