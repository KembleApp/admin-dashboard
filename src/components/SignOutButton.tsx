"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
    >
      Sign out
    </button>
  );
}
