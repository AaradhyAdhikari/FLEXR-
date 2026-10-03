import { expect, it } from "vitest";

/**
 * One assertion, named in a sentence.
 *
 * The suites this replaced were plain scripts with their own `ok(name, cond)`,
 * which read well and is kept: a failure names the behaviour that broke in
 * words, and the third argument carries the actual value into the message.
 */
export function check(name: string, cond: unknown, detail: unknown = "") {
  it(name, () => {
    expect(cond, `${name} — got: ${String(detail)}`).toBe(true);
  });
}
