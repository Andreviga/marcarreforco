import { Suspense } from "react";
import ResetPasswordClient from "./ResetPasswordClient";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-emerald-50 px-4 py-10">
          <div className="mx-auto w-full max-w-xl rounded-3xl bg-white p-8 shadow-lg ring-1 ring-slate-100">
            <p className="text-sm text-slate-600">Carregando...</p>
          </div>
        </div>
      }
    >
      <ResetPasswordClient />
    </Suspense>
  );
}
