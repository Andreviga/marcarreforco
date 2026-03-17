"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek
} from "date-fns";

interface CalendarItem {
  id: string;
  startsAt: string | Date;
  endsAt?: string | Date;
  title: string;
  subtitle?: string;
  meta?: string;
  href?: string;
  status?: string;
  hasEnrollments?: boolean;
}

const weekdayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];
const statusStyles: Record<string, { label: string; badge: string; bg: string }> = {
  ATIVA:     { label: "Ativa",     badge: "bg-emerald-100 text-emerald-700", bg: "bg-emerald-50" },
  CANCELADA: { label: "Cancelada", badge: "bg-rose-100 text-rose-700",       bg: "bg-rose-50" },
  AGENDADO:  { label: "Agendado",  badge: "bg-sky-100 text-sky-700",         bg: "bg-sky-50" },
  PRESENTE:  { label: "Presente",  badge: "bg-emerald-100 text-emerald-700", bg: "bg-emerald-50" },
  ATRASADO:  { label: "Atrasado",  badge: "bg-amber-100 text-amber-700",     bg: "bg-amber-50" },
  AUSENTE:   { label: "Ausente",   badge: "bg-slate-100 text-slate-600",     bg: "bg-slate-50" }
};

function formatTimeRange(startsAt: Date, endsAt?: Date) {
  const startLabel = format(startsAt, "HH:mm");
  if (!endsAt) return startLabel;
  return `${startLabel} - ${format(endsAt, "HH:mm")}`;
}

export default function MonthlyCalendarClient({
  month,
  year,
  items,
  showLegend = true
}: {
  month: number;
  year: number;
  items: CalendarItem[];
  showLegend?: boolean;
}) {
  const [visibleDate, setVisibleDate] = useState(new Date(year, month - 1, 1));
  const [showPast, setShowPast] = useState(false);

  // today at midnight — stable via useMemo
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const monthStart = startOfMonth(visibleDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let cur = calendarStart;
  while (cur <= calendarEnd) {
    days.push(cur);
    cur = addDays(cur, 1);
  }

  const isCurrentMonthView = isSameMonth(monthStart, today);

  const allMonthItems = useMemo(() => {
    const start = monthStart.getTime();
    const end = monthEnd.getTime();
    return items.filter((item) => {
      const v = new Date(item.startsAt).getTime();
      return v >= start && v <= end;
    });
  }, [items, monthStart, monthEnd]);

  const hasPastItems = useMemo(
    () => allMonthItems.some((i) => new Date(i.startsAt) < today),
    [allMonthItems, today]
  );
  const hasAnyEnrollments = useMemo(
    () => allMonthItems.some((i) => i.hasEnrollments),
    [allMonthItems]
  );

  const visibleItems = useMemo(
    () =>
      showPast
        ? allMonthItems
        : allMonthItems.filter((i) => new Date(i.startsAt) >= today),
    [allMonthItems, showPast, today]
  );

  const legendItems = useMemo(() => {
    const statuses = Array.from(
      new Set(visibleItems.map((i) => i.status).filter(Boolean))
    ) as string[];
    const base = statuses
      .map((s) => ({
        status: s,
        label: statusStyles[s]?.label ?? s,
        badge: statusStyles[s]?.badge ?? "bg-slate-100 text-slate-600"
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    if (hasAnyEnrollments)
      base.push({ status: "__students", label: "Com aluno", badge: "bg-indigo-100 text-indigo-700" });
    if (showPast && hasPastItems)
      base.push({ status: "__past", label: "Passada", badge: "bg-slate-200 text-slate-500" });
    return base;
  }, [visibleItems, hasAnyEnrollments, showPast, hasPastItems]);

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">Calendário do mês</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <button
            type="button"
            onClick={() => setVisibleDate((p) => addMonths(p, -1))}
            className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            ← Anterior
          </button>
          <button
            type="button"
            onClick={() => setVisibleDate(new Date(year, month - 1, 1))}
            className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            Hoje
          </button>
          <span className="font-semibold text-slate-700">{format(monthStart, "MMM yyyy")}</span>
          {isCurrentMonthView && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              Mês atual
            </span>
          )}
          <button
            type="button"
            onClick={() => setVisibleDate((p) => addMonths(p, 1))}
            className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            Próximo →
          </button>
          {hasPastItems && (
            <button
              type="button"
              onClick={() => setShowPast((p) => !p)}
              className="rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
            >
              {showPast ? "Ocultar passadas" : "Ver passadas"}
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      {showLegend && legendItems.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          {legendItems.map((item) => (
            <span key={item.status} className={`rounded-full px-2 py-1 ${item.badge}`}>
              {item.label}
            </span>
          ))}
        </div>
      )}

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 text-xs text-slate-400">
        {weekdayLabels.map((label) => (
          <div key={label} className="text-center font-semibold uppercase tracking-wide">
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="mt-2 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dayItems = visibleItems.filter((item) =>
            isSameDay(new Date(item.startsAt), day)
          );
          // also get past items for this day (to show faded) when showPast
          const allDayItems = allMonthItems.filter((item) =>
            isSameDay(new Date(item.startsAt), day)
          );
          const itemsToRender = showPast ? allDayItems : dayItems;

          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, today);

          return (
            <div
              key={day.toISOString()}
              className={[
                "min-h-[110px] rounded-lg border p-1.5",
                isCurrentMonth ? "border-slate-200 bg-white" : "border-transparent bg-slate-50",
                isToday ? "ring-2 ring-indigo-400" : ""
              ].join(" ")}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span
                  className={[
                    "font-semibold",
                    isToday
                      ? "flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white text-[10px]"
                      : isCurrentMonth
                        ? "text-slate-700"
                        : "text-slate-400"
                  ].join(" ")}
                >
                  {format(day, "d")}
                </span>
                {itemsToRender.length > 0 && (
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                    {itemsToRender.length}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                {itemsToRender.slice(0, 3).map((item) => {
                  const isPast = new Date(item.startsAt) < today;
                  const ss = item.status ? statusStyles[item.status] : undefined;

                  // Determine card bg and text based on state
                  const cardBg = isPast
                    ? "bg-slate-100"
                    : item.hasEnrollments
                      ? "bg-indigo-50 border border-indigo-200"
                      : (ss?.bg ?? "bg-slate-50");

                  const titleColor = isPast ? "text-slate-400" : "text-slate-800";

                  const badgeCls = isPast
                    ? "bg-slate-200 text-slate-400"
                    : item.hasEnrollments
                      ? "bg-indigo-100 text-indigo-700"
                      : (ss?.badge ?? "bg-slate-100 text-slate-600");

                  const badgeLabel = isPast
                    ? "Passada"
                    : item.hasEnrollments
                      ? "Com aluno"
                      : (ss?.label ?? item.status ?? "");

                  const content = (
                    <div className={`rounded-md px-1.5 py-1 text-[11px] ${cardBg} ${isPast ? "opacity-60" : ""}`}>
                      <p className={`font-semibold leading-tight ${titleColor}`}>{item.title}</p>
                      {item.subtitle && (
                        <p className="text-[10px] text-slate-500 leading-tight">{item.subtitle}</p>
                      )}
                      <p className="text-[10px] text-slate-400 leading-tight">
                        {item.meta ??
                          formatTimeRange(
                            new Date(item.startsAt),
                            item.endsAt ? new Date(item.endsAt) : undefined
                          )}
                      </p>
                      {badgeLabel && (
                        <span className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${badgeCls}`}>
                          {badgeLabel}
                        </span>
                      )}
                    </div>
                  );

                  if (item.href) {
                    return (
                      <Link key={item.id} href={item.href} className="block hover:opacity-80">
                        {content}
                      </Link>
                    );
                  }
                  return <div key={item.id}>{content}</div>;
                })}
                {itemsToRender.length > 3 && (
                  <p className="text-[10px] text-slate-400">+{itemsToRender.length - 3} mais</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
