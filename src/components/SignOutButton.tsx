"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
    >
      Sair
    </button>
  );
}
