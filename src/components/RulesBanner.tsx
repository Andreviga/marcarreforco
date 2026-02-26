"use client";

import { useEffect, useState } from "react";

type RulesBannerProps = {
  variant?: "full" | "compact";
  collapsible?: boolean;
  storageKey?: string;
  defaultOpen?: boolean;
};

export default function RulesBanner({
  variant = "full",
  collapsible = false,
  storageKey = "rulesBannerCollapsed",
  defaultOpen
}: RulesBannerProps) {
  const isCompact = variant === "compact";
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof defaultOpen === "boolean") return defaultOpen;
    if (collapsible) return !isCompact;
    return true;
  });
  const wrapperClass = isCompact
    ? "rounded-3xl border border-emerald-200/70 bg-white/90 p-5 shadow-sm"
    : "rounded-3xl border border-amber-200/70 bg-white/80 p-6 shadow-sm backdrop-blur";

  useEffect(() => {
    if (!collapsible || !isCompact || typeof window === "undefined") return;
    const saved = window.localStorage.getItem(storageKey);
    if (saved === "collapsed") {
      setIsOpen(false);
    }
  }, [collapsible, isCompact, storageKey]);

  useEffect(() => {
    if (!collapsible || !isCompact || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, isOpen ? "open" : "collapsed");
  }, [collapsible, isCompact, isOpen, storageKey]);

  return (
    <section className={wrapperClass}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${isCompact ? "text-emerald-700" : "text-amber-700"}`}>
            Colégio Raízes
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">
            Plantão de Dúvidas 2026
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Todos os valores abaixo são mensais. Cada dia no plano equivale a 1 aula por semana,
            com 50 minutos por aula (12h30 às 13h20).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`rounded-2xl px-4 py-3 text-xs font-semibold ${isCompact ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
            IMPORTANTE
          </div>
          {collapsible && (
            <button
              type="button"
              onClick={() => setIsOpen((prev) => !prev)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${isOpen ? "border-emerald-200 text-emerald-700" : "border-slate-200 text-slate-600"}`}
            >
              {isOpen ? "Ocultar" : isCompact ? "Ver regras" : "Saiba mais"}
            </button>
          )}
        </div>
      </div>

      {(!collapsible || isOpen) && (
        <div>
          <div className={isCompact ? "mt-5 grid gap-4 lg:grid-cols-2" : "mt-6 grid gap-6 md:grid-cols-2"}>
        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Público atendido</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            <li>1º ao 3º ano</li>
            <li>4º ao 9º ano</li>
            <li className="font-semibold text-rose-600">Ensino Médio não tem plantão de dúvidas.</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Regras rápidas</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            <li>Vagas conforme formação de turma.</li>
            <li>Valores promocionais de lançamento.</li>
            <li>Pagamento mensal antecipado.</li>
            <li>Alterações e solicitações com 2 dias de antecedência.</li>
            <li>Turmas abaixo do mínimo podem ser reagrupadas por nível/horário.</li>
          </ul>
        </div>
      </div>

      <div className={isCompact ? "mt-5 grid gap-4 lg:grid-cols-2" : "mt-6 grid gap-6 lg:grid-cols-2"}>
        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900">1º ao 3º ano</h4>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              Regras específicas
            </span>
          </div>
          <ul className="mt-3 space-y-1 text-sm text-slate-600">
            <li>Máximo de 2 dias por semana por aluno.</li>
            <li>Disciplinas: Inglês e professora da turma (reforço da turma).</li>
          </ul>
          <div className="mt-3 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Valores mensais</p>
            <ul className="mt-1 space-y-1">
              <li>1 dia/semana: R$ 22,00</li>
              <li>2 dias/semana: R$ 39,00</li>
            </ul>
          </div>
          <div className="mt-3 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Avulso</p>
            <p>R$ 7,00 por aula (50 min).</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900">4º ao 9º ano</h4>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
              Dia fixo
            </span>
          </div>
          <ul className="mt-3 space-y-1 text-sm text-slate-600">
            <li>Plantão com dia fixo da semana.</li>
            <li>4º ano: até 4 dias por semana.</li>
          </ul>
          <div className="mt-3 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Valores mensais</p>
            <ul className="mt-1 space-y-1">
              <li>1 dia/semana: R$ 27,00</li>
              <li>2 dias/semana: R$ 48,00</li>
              <li>3 dias/semana: R$ 66,00</li>
              <li>4 dias/semana: R$ 81,00</li>
              <li>5 dias/semana: R$ 95,00 (somente 5º ao 9º)</li>
            </ul>
          </div>
          <div className="mt-3 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Avulso</p>
            <p>R$ 9,00 por aula (50 min).</p>
          </div>
        </div>
      </div>
        </div>
      )}
    </section>
  );
}
