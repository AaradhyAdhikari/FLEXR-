"use client";

import { useState } from "react";
import { buyLinks, searchTerm } from "@/lib/shops";

/**
 * Open a shop's search with what you want already typed in.
 *
 * Deliberately modest: no prices, no comparison, no cart. Those would need APIs
 * these shops don't offer to anyone outside their own apps, and scraping them
 * would break their terms and break constantly.
 */
export default function BuyLinks({ suggestions = [] }: { suggestions?: string[] }) {
  const [what, setWhat] = useState("");
  const links = buyLinks(what);

  return (
    <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--line)" }} data-testid="buy">
      <h3 className="text-xs uppercase tracking-[0.07em] muted font-bold mb-2">Buy it</h3>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input flex-1 min-w-[160px] !py-1.5"
          type="text"
          maxLength={60}
          value={what}
          placeholder="whey protein, paneer, oats…"
          aria-label="What to buy"
          onChange={(e) => setWhat(e.target.value)}
        />
        {links.map(({ shop, url }) => (
          <a key={shop.id} className="btn btn-sm" href={url} target="_blank" rel="noopener noreferrer">
            {shop.name}
          </a>
        ))}
        {!links.length && <span className="text-[12.5px] muted">Type what you want, then pick a shop.</span>}
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {suggestions.slice(0, 8).map((s) => (
            <button key={s} className="btn btn-sm btn-ghost" onClick={() => setWhat(searchTerm(s))}>
              {searchTerm(s)}
            </button>
          ))}
        </div>
      )}

      <p className="text-[11.5px] muted mt-2 mb-0">
        Opens the shop&apos;s own search — their app if you have it, otherwise their site. Flexr can&apos;t see their prices or
        stock: none of them offer that to other apps, so anything it showed you would be a guess.
      </p>
    </div>
  );
}
