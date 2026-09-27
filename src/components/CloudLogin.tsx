"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Email sign-in: Supabase emails a link (and a code, if the email template includes one). */
export default function CloudLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Already signed in (or just came back from the email link)? Go to the dashboard.
  useEffect(() => {
    const db = supabase();
    db.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
    const { data: sub } = db.auth.onAuthStateChange((_e, session) => {
      if (session) router.replace("/");
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  async function sendEmail(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) return setError("Enter a valid email address.");
    setBusy(true);
    const { error } = await supabase().auth.signInWithOtp({
      email: clean,
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin + "/" },
    });
    setBusy(false);
    if (error) {
      setError(
        /rate|limit|seconds/i.test(error.message)
          ? "Too many emails sent. Wait a minute and try again."
          : "Couldn't send the email. Check the address and try again."
      );
      return;
    }
    setEmail(clean);
    setStep("code");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const token = code.replace(/\s/g, "");
    if (!/^\d{6,10}$/.test(token)) return setError("Enter the code from the email.");
    setBusy(true);
    const { error } = await supabase().auth.verifyOtp({ email, token, type: "email" });
    setBusy(false);
    if (error) return setError("That code didn't work. It may have expired — request a new one.");
    router.replace("/");
  }

  return (
    <form className="panel flex flex-col gap-3.5" onSubmit={step === "email" ? sendEmail : verifyCode} noValidate>
      <h2 className="h2 !mb-0">Sign in</h2>

      {step === "email" ? (
        <>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              className="input"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && <ErrorBox text={error} />}
          <button type="submit" className="btn btn-primary !py-2.5" disabled={busy}>
            {busy ? "Sending…" : "Email me a sign-in link"}
          </button>
          <p className="text-[12px] muted m-0">No password needed. New here? This creates your account.</p>
        </>
      ) : (
        <>
          <p className="text-sm m-0">
            We sent an email to <b>{email}</b>. Open it on this device and tap the link, or type the code from it below.
          </p>
          <div>
            <label className="label" htmlFor="code">Code (if your email has one)</label>
            <input
              id="code"
              className="input num tracking-[0.3em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          {error && <ErrorBox text={error} />}
          <button type="submit" className="btn btn-primary !py-2.5" disabled={busy}>
            {busy ? "Checking…" : "Sign in with code"}
          </button>
          <button type="button" className="btn btn-ghost btn-sm self-start" onClick={() => { setStep("email"); setCode(""); setError(""); }}>
            Use a different email
          </button>
        </>
      )}
    </form>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <p className="text-sm font-semibold rounded-[9px] px-3 py-2 m-0" style={{ background: "var(--bad-bg)", color: "var(--bad)" }} role="alert">
      {text}
    </p>
  );
}
