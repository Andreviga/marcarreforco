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
import { ptBR } from "date-fns/locale";

interface CalendarItem {
  id: string;
  startsAt: string | Date;
  endsAt?: string | Date;
  title: string;
  subtitle?: string;
  meta?: string;
  href?: string;
  status?: string;
}

const weekdayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];
const statusStyles: Record<string, { label: string; badge: string; bg: string }> = {
  ATIVA: { label: "Ativa", badge: "bg-emerald-100 text-emerald-700", bg: "bg-emerald-50" },
  CANCELADA: { label: "Cancelada", badge: "bg-rose-100 text-rose-700", bg: "bg-rose-50" },
  AGENDADO: { label: "Agendado", badge: "bg-sky-100 text-sky-700", bg: "bg-sky-50" },
  PRESENTE: { label: "Presente", badge: "bg-emerald-100 text-emerald-700", bg: "bg-emerald-50" },
  ATRASADO: { label: "Atrasado", badge: "bg-amber-100 text-amber-700", bg: "bg-amber-50" },
  AUSENTE: { label: "Ausente", badge: "bg-slate-100 text-slate-600", bg: "bg-slate-50" }
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
  const monthStart = startOfMonth(visibleDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let current = calendarStart;
  while (current <= calendarEnd) {
    days.push(current);
    current = addDays(current, 1);
  }

  const today = new Date();
  const isCurrentMonthView = isSameMonth(monthStart, today);
  const visibleItems = useMemo(() => {
    const start = monthStart.getTime();
    const end = monthEnd.getTime();
    return items.filter((item) => {
      const value = new Date(item.startsAt).getTime();
      return value >= start && value <= end;
    });
  }, [items, monthStart, monthEnd]);

  const legendItems = useMemo(() => {
    const statuses = Array.from(new Set(visibleItems.map((item) => item.status).filter(Boolean))) as string[];
    return statuses
      .map((status) => ({
        status,
        label: statusStyles[status]?.label ?? status,
        badge: statusStyles[status]?.badge ?? "bg-slate-100 text-slate-600"
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [visibleItems]);

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Calendário do mês</h2>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <button
            type="button"
            onClick={() => setVisibleDate((prev) => addMonths(prev, -1))}
            className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            ◀ Anterior
          </button>
          <button
            type="button"
            onClick={() => setVisibleDate(today)}
            className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            Hoje
          </button>
          <span className="font-semibold text-slate-700">{format(monthStart, "MMMM 'de' yyyy", { locale: ptBR })}</span>
          {isCurrentMonthView && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              Mês atual
            </span>
          )}
          <button
            type="button"
            onClick={() => setVisibleDate((prev) => addMonths(prev, 1))}
            className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            Próximo ▶
          </button>
        </div>
      </div>
      {showLegend && legendItems.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          {legendItems.map((item) => (
            <span key={item.status} className={`rounded-full px-2 py-1 ${item.badge}`}>
              {item.label}
            </span>
          ))}
        </div>
      )}
      <div className="grid grid-cols-7 gap-2 text-xs text-slate-400">
        {weekdayLabels.map((label) => (
          <div key={label} className="text-center font-semibold uppercase tracking-wide">
            {label}
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dayItems = visibleItems.filter((item) =>
            isSameDay(new Date(item.startsAt), day)
          );
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, today);

          return (
            <div
              key={day.toISOString()}
              className={`min-h-[110px] rounded-lg border p-2 ${
                isCurrentMonth ? "border-slate-100" : "border-transparent bg-slate-50 text-slate-400"
              } ${isToday ? "ring-1 ring-slate-300" : ""}`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className={isCurrentMonth ? "text-slate-700" : "text-slate-400"}>
                  {format(day, "d")}
                </span>
                {dayItems.length > 0 && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                    {dayItems.length}
                  </span>
                )}
              </div>
              <div className="mt-1 space-y-1">
                {dayItems.slice(0, 3).map((item) => {
                  const statusStyle = item.status ? statusStyles[item.status] : undefined;
                  const content = (
                    <div className={`rounded-md px-2 py-1 text-[11px] text-slate-700 ${statusStyle?.bg ?? "bg-slate-50"}`}>
                      <p className="font-semibold text-slate-800">{item.title}</p>
                      {item.subtitle && <p className="text-[10px] text-slate-500">{item.subtitle}</p>}
                      <p className="text-[10px] text-slate-400">
                        {item.meta ?? formatTimeRange(new Date(item.startsAt), item.endsAt ? new Date(item.endsAt) : undefined)}
                      </p>
                      {item.status && (
                        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] ${statusStyle?.badge ?? "bg-slate-100 text-slate-600"}`}>
                          {statusStyle?.label ?? item.status}
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
                {dayItems.length > 3 && (
                  <p className="text-[10px] text-slate-400">+{dayItems.length - 3} mais</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
