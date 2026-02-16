"use client";

import { useState, useEffect, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import type { EventInput, EventClickArg } from "@fullcalendar/core";
import { CalendarDays, X } from "lucide-react";

type BookingCalendarProps = {
  selectedOvenId: number | null;
  onDateClick?: (dateStr: string) => void;
};

type EventExtendedProps = {
  ovenName: string;
  ovenType: string;
  userName: string;
  purpose: string;
  usageTemp: number;
  flap: number;
  isOwn: boolean;
};

export default function BookingCalendar({
  selectedOvenId,
  onDateClick,
}: BookingCalendarProps) {
  const [events, setEvents] = useState<EventInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    data: EventExtendedProps | null;
    title: string;
    start: string;
    end: string;
  }>({ visible: false, x: 0, y: 0, data: null, title: "", start: "", end: "" });

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const url = selectedOvenId
        ? `/api/bookings?ovenId=${selectedOvenId}`
        : "/api/bookings";
      const res = await fetch(url);
      const data = await res.json();
      setEvents(data);
    } catch {
      console.error("Failed to fetch bookings");
    } finally {
      setLoading(false);
    }
  }, [selectedOvenId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  function handleDateClick(info: DateClickArg) {
    // Convert clicked date to datetime-local format
    const date = new Date(info.dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const formatted = `${year}-${month}-${day}T08:00`;
    onDateClick?.(formatted);
  }

  function handleEventClick(info: EventClickArg) {
    const rect = info.el.getBoundingClientRect();
    const ext = info.event.extendedProps as EventExtendedProps;
    setTooltip({
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      data: ext,
      title: info.event.title,
      start: info.event.startStr,
      end: info.event.endStr,
    });
  }

  function closeTooltip() {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-orange-400" />
          <h2 className="text-lg font-semibold text-white">Booking Calendar</h2>
        </div>
        {loading && (
          <span className="text-xs text-slate-400 animate-pulse">
            Loading...
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-4 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-orange-600" />
          <span>Non-Aqueous</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-blue-600" />
          <span>Aqueous</span>
        </div>
        <span className="text-slate-500">
          {selectedOvenId
            ? "Showing selected oven"
            : "Showing all ovens"}
        </span>
      </div>

      <div className="fc-dark-theme">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          events={events}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "",
          }}
          height="auto"
          dayMaxEvents={3}
          eventDisplay="block"
          eventTimeFormat={{
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }}
          firstDay={1}
        />
      </div>

      {/* Event tooltip */}
      {tooltip.visible && tooltip.data && (
        <div
          className="fixed z-50 bg-slate-900 border border-slate-600 rounded-lg p-3 shadow-xl max-w-xs"
          style={{
            left: `${Math.min(tooltip.x, window.innerWidth - 280)}px`,
            top: `${Math.max(tooltip.y - 120, 10)}px`,
          }}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-sm font-medium text-white">
              {tooltip.data.ovenName}
            </p>
            <button
              onClick={closeTooltip}
              className="text-slate-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-1 text-xs text-slate-400">
            <p>
              <span className="text-slate-300">Booked by:</span>{" "}
              {tooltip.data.isOwn ? "You" : tooltip.data.userName}
            </p>
            <p>
              <span className="text-slate-300">Start:</span>{" "}
              {new Date(tooltip.start).toLocaleString()}
            </p>
            <p>
              <span className="text-slate-300">End:</span>{" "}
              {new Date(tooltip.end).toLocaleString()}
            </p>
            <p>
              <span className="text-slate-300">Purpose:</span>{" "}
              {tooltip.data.purpose}
            </p>
            <p>
              <span className="text-slate-300">Temp:</span>{" "}
              {tooltip.data.usageTemp}°C
            </p>
            <p>
              <span className="text-slate-300">Flap:</span>{" "}
              {tooltip.data.flap}%
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
