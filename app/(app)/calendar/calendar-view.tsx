"use client";

import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";
import "@fullcalendar/react/themes/classic/palette.css";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import frLocale from "@fullcalendar/react/locales/fr";
import classicTheme from "@fullcalendar/react/themes/classic";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { ActionState } from "@/components/form-status";
import { STATUS_COLORS, isPostStatus } from "@/lib/posts";

export type CalendarEvent = {
  id: string;
  // Heure locale du fuseau du propriétaire, sans décalage : "2026-12-03T09:30:00"
  start: string;
  title: string;
  status: string;
  editable: boolean;
};

// F-23 à F-25 : vue mois / semaine, couleur par statut, glisser-déposer, clic pour ouvrir
export function CalendarView({
  events,
  initialDate,
  move,
}: {
  events: CalendarEvent[];
  initialDate: string;
  move: (postId: string, local: string) => Promise<ActionState>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<ActionState>(undefined);

  return (
    <div className="flex flex-col gap-3">
      {message?.error && (
        <p role="alert" className="text-sm text-destructive">
          {message.error}
        </p>
      )}
      {message?.message && (
        <p role="status" className="text-sm text-green-700">
          {message.message}
        </p>
      )}
      <FullCalendar
        plugins={[classicTheme, dayGridPlugin, timeGridPlugin, interactionPlugin]}
        locale={frLocale}
        // Les heures sont déjà converties dans le fuseau du propriétaire : on les affiche telles quelles
        timeZone="UTC"
        initialView="dayGridMonth"
        initialDate={initialDate}
        headerToolbar={{ start: "prev,next today", center: "title", end: "dayGridMonth,timeGridWeek" }}
        height="auto"
        editable
        eventStartEditable
        eventDurationEditable={false}
        dayMaxEvents={4}
        events={events.map((e) => ({
          id: e.id,
          start: `${e.start}Z`,
          title: e.title,
          editable: e.editable,
          // Couleur par statut (F-24), affichée en bloc plein
          color: isPostStatus(e.status) ? STATUS_COLORS[e.status] : undefined,
          contrastColor: "#ffffff",
          display: "block",
        }))}
        eventClick={(info) => {
          info.jsEvent.preventDefault();
          router.push(`/content/${info.event.id}`);
        }}
        eventDrop={async (info) => {
          const start = info.event.start;
          if (!start) return info.revert();
          const local = start.toISOString().slice(0, 16);
          const result = await move(info.event.id, local);
          setMessage(result);
          if (result?.error) info.revert();
          else router.refresh();
        }}
        datesSet={(info) => {
          // Recharge les publications quand on navigue loin de la période chargée
          const current = searchParams.get("date") ?? initialDate;
          const mid = new Date((info.start.getTime() + info.end.getTime()) / 2).toISOString().slice(0, 10);
          const diffDays = Math.abs(new Date(mid).getTime() - new Date(current).getTime()) / 86_400_000;
          if (diffDays > 45) {
            const params = new URLSearchParams(searchParams.toString());
            params.set("date", mid);
            router.replace(`/calendar?${params}`);
          }
        }}
      />
    </div>
  );
}
