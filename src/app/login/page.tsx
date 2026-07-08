"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="mb-1 text-lg font-semibold">User Admin Dashboard</h1>
        <p className="mb-6 text-sm text-slate-500">
          Internal access only. Sign in with an allowlisted admin account.
        </p>
        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Sign in with Google
        </button>
      </div>
    </main>
  );
}
