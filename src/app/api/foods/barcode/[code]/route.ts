import { NextRequest, NextResponse } from "next/server";
import { isBarcode, parseOffProduct } from "@/lib/off";

// Open Food Facts asks every app to identify itself; browsers can't set User-Agent, so lookups go through here.
const OFF_URL = process.env.OFF_URL || "https://world.openfoodfacts.org"; // override only for tests
const USER_AGENT = "Flexr/0.1 (+https://github.com/AaradhyAdhikari/FLEXR-)";
const FIELDS = "code,product_name,product_name_en,brands,quantity,serving_size,serving_quantity,nutriments";

// Keep well under Open Food Facts' limit of ~15 product reads per minute per IP.
const hits: number[] = [];
function limited(): boolean {
  const now = Date.now();
  while (hits.length && now - hits[0] > 60_000) hits.shift();
  if (hits.length >= 12) return true;
  hits.push(now);
  return false;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!isBarcode(code)) {
    return NextResponse.json({ error: "That doesn't look like a barcode (8, 12, 13 or 14 digits)." }, { status: 400 });
  }
  if (limited()) {
    return NextResponse.json({ error: "Too many scans right now. Try again in a minute." }, { status: 429 });
  }
  try {
    const res = await fetch(`${OFF_URL}/api/v2/product/${code}?fields=${FIELDS}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      next: { revalidate: 86400 }, // product data rarely changes; cache a day
    });
    if (res.status === 404) return NextResponse.json({ found: false }, { status: 200 });
    if (!res.ok) return NextResponse.json({ error: "Open Food Facts didn't answer. Try again." }, { status: 502 });
    const food = parseOffProduct(await res.json(), code);
    return NextResponse.json(
      food ? { found: true, food } : { found: false },
      { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } }
    );
  } catch {
    return NextResponse.json({ error: "Couldn't reach Open Food Facts." }, { status: 502 });
  }
}
