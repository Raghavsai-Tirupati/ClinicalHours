import { supabase } from "@/integrations/supabase/client";

export interface ActivityEvent {
  id: string;
  timestamp: string;
  userEmail: string | null;
  action: string;
  target: string;
}

export async function fetchAdminActivityFeed(
  limit = 50
): Promise<{ events: ActivityEvent[] }> {
  const { data: eventsData, error: eventsError } = await supabase
    .from("tracking_events")
    .select("id, created_at, event_type, page_url, metadata, user_id, session_id")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (eventsError) {
    throw new Error(eventsError.message);
  }

  const rows = eventsData ?? [];

  const userIds = [
    ...new Set(
      rows
        .map((r) => r.user_id)
        .filter((id): id is string => id != null && id !== "")
    ),
  ];

  let nameMap: Record<string, string> = {};

  if (userIds.length > 0) {
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    if (profilesData) {
      for (const p of profilesData) {
        // Prefer full_name when available, but always provide a stable fallback
        nameMap[p.id] = p.full_name && typeof p.full_name === "string" && p.full_name.trim().length > 0
          ? p.full_name
          : `User ${String(p.id).slice(0, 6)}`;
      }
    }
  }

  // Generate stable, per-day guest labels based on session_id,
  // using chronological order so the earliest guest of the day is #1.
  const guestCountByDate = new Map<string, number>();
  const guestLabelBySessionAndDate = new Map<string, string>();

  const rowsSortedChronologically = [...rows].sort((a, b) =>
    (a.created_at ?? "").localeCompare(b.created_at ?? "")
  );

  for (const row of rowsSortedChronologically) {
    if (row.user_id) continue;
    const dateKey = row.created_at.slice(0, 10); // yyyy-mm-dd
    const sessionId = (row.session_id as string | null) ?? "unknown";
    const compositeKey = `${dateKey}:${sessionId}`;

    if (guestLabelBySessionAndDate.has(compositeKey)) continue;

    const currentCount = guestCountByDate.get(dateKey) ?? 0;
    const nextCount = currentCount + 1;
    guestCountByDate.set(dateKey, nextCount);
    guestLabelBySessionAndDate.set(compositeKey, `Guest #${nextCount}`);
  }

  const getGuestLabelForRow = (row: {
    created_at: string;
    session_id: string | null;
  }): string => {
    const dateKey = row.created_at.slice(0, 10);
    const sessionId = row.session_id ?? "unknown";
    const compositeKey = `${dateKey}:${sessionId}`;
    return guestLabelBySessionAndDate.get(compositeKey) ?? "Guest";
  };

  const events: ActivityEvent[] = rows.map((row) => {
    const metadata = row.metadata as Record<string, unknown> | null;
    const targetFromMeta =
      metadata?.target != null && typeof metadata.target === "string"
        ? metadata.target
        : null;
    const target = targetFromMeta ?? row.page_url ?? "";

    const userId = row.user_id as string | null;

    return {
      id: row.id,
      timestamp: row.created_at,
      userEmail: userId
        ? // If we have a user_id but no name in the map, fall back to an abbreviated ID
          nameMap[userId] ?? `User ${userId.slice(0, 6)}`
        : getGuestLabelForRow(row),
      action: row.event_type ?? "",
      target,
    };
  });

  return { events };
}
