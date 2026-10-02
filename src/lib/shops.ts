/**
 * "Buy it" links.
 *
 * None of these shops have an API anyone outside them can use, so Flexr can't
 * show their prices, their stock, or place an order. What it can do is open a
 * search with your words already typed, which saves the typing and claims
 * nothing it can't back up. On a phone these open the shop's own app when it's
 * installed; otherwise the website.
 */

export type Shop = { id: string; name: string; search: (q: string) => string };

export const SHOPS: Shop[] = [
  { id: "blinkit", name: "Blinkit", search: (q) => `https://blinkit.com/s/?q=${encodeURIComponent(q)}` },
  { id: "zepto", name: "Zepto", search: (q) => `https://www.zeptonow.com/search?query=${encodeURIComponent(q)}` },
  { id: "instamart", name: "Instamart", search: (q) => `https://www.swiggy.com/instamart/search?custom_back=true&query=${encodeURIComponent(q)}` },
  { id: "amazon", name: "Amazon", search: (q) => `https://www.amazon.in/s?k=${encodeURIComponent(q)}` },
];

/** Tidy a food name into something worth searching for. */
export function searchTerm(name: string): string {
  return (name || "")
    .replace(/\([^)]*\)/g, " ") // "Egg (whole)" → "Egg"
    .replace(/\b(raw|cooked|boiled|dry|fresh|homemade)\b/gi, " ")
    .replace(/[,/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Where to send someone who wants to buy `what`. Empty in, empty out. */
export function buyLinks(what: string): { shop: Shop; url: string }[] {
  const q = searchTerm(what);
  if (!q) return [];
  return SHOPS.map((shop) => ({ shop, url: shop.search(q) }));
}
