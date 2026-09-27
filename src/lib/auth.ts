"use client";

import { Profile } from "./types";

// Simple local sign-in for the MVP: name + age + email or phone.
// There is no password or OTP yet, and accounts live only in this browser.
// Milestone 2 swaps this for Supabase Auth (email/phone OTP) behind the same functions.

const USERS_KEY = "flexr-users";
const SESSION_KEY = "flexr-session";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type ContactResult =
  | { ok: true; type: "email" | "phone"; value: string }
  | { ok: false; error: string };

export function normalizeContact(type: "email" | "phone", raw: string): ContactResult {
  const v = raw.trim();
  if (type === "email") {
    const email = v.toLowerCase();
    if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address." };
    return { ok: true, type, value: email };
  }
  const digits = v.replace(/[\s\-()]/g, "");
  if (!/^\+?\d{10,15}$/.test(digits)) return { ok: false, error: "Enter a valid phone number (10–15 digits)." };
  // Treat a bare 10-digit number as Indian (+91) so "98765 43210" and "+919876543210" match.
  const value = digits.startsWith("+") ? digits : digits.length === 10 ? "+91" + digits : "+" + digits;
  return { ok: true, type, value };
}

export function validateProfile(name: string, age: string): string | null {
  if (!name.trim()) return "Enter your name.";
  if (name.trim().length > 50) return "Name is too long.";
  const n = Number(age);
  if (!Number.isInteger(n) || n < 10 || n > 100) return "Enter an age between 10 and 100.";
  return null;
}

function readUsers(): Record<string, Profile> {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeUsers(users: Record<string, Profile>) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    /* storage unavailable */
  }
}

/** Sign in, creating the account on first use and updating name/age on later ones. */
export function signIn(input: { name: string; age: number; type: "email" | "phone"; contact: string }): Profile {
  const users = readUsers();
  const id = `${input.type}:${input.contact}`;
  const existing = users[id];
  const profile: Profile = {
    id,
    name: input.name.trim(),
    age: input.age,
    contact: input.contact,
    contactType: input.type,
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
  users[id] = profile;
  writeUsers(users);
  try {
    localStorage.setItem(SESSION_KEY, id);
  } catch {
    /* storage unavailable */
  }
  return profile;
}

export function currentUser(): Profile | null {
  try {
    const id = localStorage.getItem(SESSION_KEY);
    if (!id) return null;
    return readUsers()[id] || null;
  } catch {
    return null;
  }
}

export function signOut() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable */
  }
}
