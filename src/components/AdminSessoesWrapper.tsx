"use client";

import { useState } from "react";
import MonthlyCalendarClient from "@/components/MonthlyCalendarClient";
import AdminSessionsClient from "@/components/AdminSessionsClient";

interface CalendarItem {
  id: string;
  startsAt: string | Date;
  endsAt?: string | Date;
  title: string;
  subtitle?: string;
  meta?: string;
  status?: string;
  hasEnrollments?: boolean;
}

interface Subject {
  id: string;
  name: string;
  defaultPriceCents?: number;
}

interface Teacher {
  id: string;
  name: string;
}

interface StudentOption {
  id: string;
  name: string;
  email: string;
}

interface SessionItem {
  id: string;
  startsAt: string | Date;
  endsAt: string | Date;
  location: string;
  modality: string;
  priceCents: number;
  status: string;
  subject: Subject;
  teacher: Teacher;
  enrollments: Array<{
    id: string;
    student: { id: string; name: string; email: string };
  }>;
}

export default function AdminSessoesWrapper({
  month,
  year,
  calendarItems,
  sessions,
  subjects,
  teachers,
  students
}: {
  month: number;
  year: number;
  calendarItems: CalendarItem[];
  sessions: SessionItem[];
  subjects: Subject[];
  teachers: Teacher[];
  students: StudentOption[];
}) {
  const [pendingEditId, setPendingEditId] = useState<string | null>(null);

  return (
    <>
      <MonthlyCalendarClient
        month={month}
        year={year}
        items={calendarItems}
        onClickItem={(id) => setPendingEditId(id)}
      />
      <AdminSessionsClient
        sessions={sessions}
        subjects={subjects}
        teachers={teachers}
        students={students}
        pendingEditId={pendingEditId}
        onPendingEditHandled={() => setPendingEditId(null)}
      />
    </>
  );
}
