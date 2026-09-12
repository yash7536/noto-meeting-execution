"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { useCopilotStore } from "@/lib/store";
import { MeetingRow } from "@/app/dashboard/page";

export default function MeetingsPage() {
  const meetings = useCopilotStore((s) => s.meetings);
  const items = useCopilotStore((s) => s.items);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return meetings;
    const q = query.toLowerCase();
    return meetings.filter((m) => m.title.toLowerCase().includes(q) || m.team.toLowerCase().includes(q));
  }, [meetings, query]);

  return (
    <AppShell>
      <div className="w-full px-gutter-desktop py-space-xl max-w-7xl mx-auto flex flex-col gap-space-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
          <div className="flex flex-col gap-space-2xs">
            <h1 className="font-display-lg text-display-lg text-on-surface font-bold tracking-tight">Meetings</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">Every transcript ingested into the pipeline, with live execution status.</p>
          </div>
          <div className="relative w-full md:w-72">
            <Icon name="search" className="absolute left-space-sm top-1/2 -translate-y-1/2 text-outline text-lg" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-space-md py-2 bg-surface-container-lowest rounded-lg font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-low shadow-sm transition-all"
              placeholder="Search meetings or teams..."
            />
          </div>
        </div>

        <div className="flex flex-col gap-space-sm">
          {filtered.length === 0 && (
            <div className="bg-surface-container-lowest p-space-xl rounded-xl shadow-sm text-center text-on-surface-variant font-body-md text-body-md">
              No meetings match &ldquo;{query}&rdquo;.
            </div>
          )}
          {filtered.map((m) => (
            <MeetingRow key={m.id} meeting={m} allItems={items.filter((i) => i.meetingId === m.id)} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
