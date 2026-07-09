"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-kemble-ink">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 text-center shadow-lg">
        <Image src="/kemble-mark.png" alt="" width={40} height={40} className="mx-auto mb-4" priority />
        <h1 className="font-display mb-1 text-xl italic text-kemble-ink">User Admin Dashboard</h1>
        <p className="mb-6 text-sm text-kemble-ink/50">
          Internal access only. Sign in with an allowlisted admin account.
        </p>
        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="w-full rounded-md bg-kemble-ink px-4 py-2 text-sm font-medium text-white hover:bg-kemble-navy"
        >
          Sign in with Google
        </button>
      </div>
    </main>
  );
}
