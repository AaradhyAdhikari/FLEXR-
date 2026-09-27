"use client";

import CloudLogin from "@/components/CloudLogin";
import LocalLogin from "@/components/LocalLogin";
import { cloudEnabled } from "@/lib/supabase";

export default function LoginPage() {
  return (
    <main className="min-h-screen grid place-items-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-[42px] h-[42px] rounded-[10px] grid place-items-center font-display font-bold text-[21px]" style={{ background: "var(--ink)", color: "var(--bg)" }}>
            F
          </div>
          <div>
            <h1 className="font-display font-bold text-[30px] uppercase leading-none m-0">Flexr</h1>
            <p className="text-[13px] muted m-0 mt-0.5">How am I doing today?</p>
          </div>
        </div>
        {cloudEnabled ? <CloudLogin /> : <LocalLogin />}
      </div>
    </main>
  );
}
