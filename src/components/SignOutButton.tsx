"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="rounded-md border border-kemble-ink/20 px-3 py-1.5 text-sm hover:bg-kemble-cream"
    >
      Sign out
    </button>
  );
}
