"use client";

import { useState } from "react";
import { validateProfile } from "@/lib/auth";

/** Asked once, right after the first email sign-in. */
export default function ProfileSetup({ email, onSave }: { email: string; onSave: (name: string, age: number) => Promise<void> }) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateProfile(name, age);
    if (err) return setError(err);
    setBusy(true);
    setError("");
    try {
      await onSave(name.trim(), Number(age));
    } catch {
      setError("Couldn't save. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-4 py-10">
      <form className="panel w-full max-w-[400px] flex flex-col gap-3.5" onSubmit={submit} noValidate>
        <div>
          <h2 className="h2 !mb-1">Welcome to Flexr</h2>
          <p className="text-[13px] muted m-0">Signed in as {email}. Tell us a bit about you.</p>
        </div>
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" className="input" type="text" autoComplete="name" maxLength={50} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="age">Age</label>
          <input id="age" className="input num" type="number" inputMode="numeric" min={10} max={100} value={age} onChange={(e) => setAge(e.target.value)} />
        </div>
        {error && (
          <p className="text-sm font-semibold rounded-[9px] px-3 py-2 m-0" style={{ background: "var(--bad-bg)", color: "var(--bad)" }} role="alert">{error}</p>
        )}
        <button type="submit" className="btn btn-primary !py-2.5" disabled={busy}>{busy ? "Saving…" : "Continue"}</button>
      </form>
    </main>
  );
}
