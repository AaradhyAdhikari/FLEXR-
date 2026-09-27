"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentUser, normalizeContact, signIn, validateProfile } from "@/lib/auth";

export default function LocalLogin() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [type, setType] = useState<"email" | "phone">("email");
  const [contact, setContact] = useState("");
  const [error, setError] = useState("");

  // Already signed in on this device? Go straight to the dashboard.
  useEffect(() => {
    if (currentUser()) router.replace("/");
  }, [router]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const profileError = validateProfile(name, age);
    if (profileError) return setError(profileError);
    const c = normalizeContact(type, contact);
    if (!c.ok) return setError(c.error);
    signIn({ name, age: Number(age), type: c.type, contact: c.value });
    router.replace("/");
  }

  return (
        <form className="panel flex flex-col gap-3.5" onSubmit={submit} noValidate>
          <h2 className="h2 !mb-0">Sign in</h2>

          <div>
            <label className="label" htmlFor="name">Name</label>
            <input id="name" className="input" type="text" autoComplete="name" maxLength={50} value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <label className="label" htmlFor="age">Age</label>
            <input id="age" className="input num" type="number" inputMode="numeric" min={10} max={100} value={age} onChange={(e) => setAge(e.target.value)} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="label !mb-0">Sign in with</span>
              <div className="seg" role="group" aria-label="Sign in with">
                <button type="button" className="!py-1 !px-2.5 !text-[13px]" aria-pressed={type === "email"} onClick={() => { setType("email"); setContact(""); setError(""); }}>Email</button>
                <button type="button" className="!py-1 !px-2.5 !text-[13px]" aria-pressed={type === "phone"} onClick={() => { setType("phone"); setContact(""); setError(""); }}>Phone</button>
              </div>
            </div>
            <input
              id="contact"
              className="input"
              type={type === "email" ? "email" : "tel"}
              inputMode={type === "email" ? "email" : "tel"}
              autoComplete={type === "email" ? "email" : "tel"}
              placeholder={type === "email" ? "you@example.com" : "98765 43210"}
              aria-label={type === "email" ? "Email" : "Phone number"}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm font-semibold rounded-[9px] px-3 py-2 m-0" style={{ background: "var(--bad-bg)", color: "var(--bad)" }} role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary !py-2.5">Continue</button>

          <p className="text-[12px] muted m-0">
            Using the same email or phone again opens your saved plans and logs. For now your data is kept in this browser only.
          </p>
        </form>
  );
}
