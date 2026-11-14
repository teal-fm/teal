import type { ListeningView, MomentView } from "./api";

export function ordinal(n: number) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const suffix = ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10];
  return `${n}${suffix ?? "th"}`;
}

/** "now", "4m", "2h", "3d": compact times for chips and rows. */
export function shortAgo(iso: string, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

/** One line about someone's listening, from the numbers Aqua returns. */
export function listeningFact(l: ListeningView): string | undefined {
  if (l.firstReleaseListen && l.releaseName) return `First time on ${l.releaseName}`;
  if (l.releasePlaysToday >= 3 && l.releaseName) {
    return `${ordinal(l.releasePlaysToday)} song from ${l.releaseName} today`;
  }
  if (l.trackPlaysToday >= 2) return `On repeat · ${l.trackPlaysToday} plays today`;
  return undefined;
}

function names(m: MomentView) {
  const shown = m.listeners.map((p) => p.displayName || p.handle || "someone");
  if (shown.length === 0) return undefined;
  const others = m.listenerCount - shown.length;
  if (others > 0) return `${shown.slice(0, 2).join(", ")} and ${others + shown.slice(2).length} others`;
  if (shown.length === 1) return shown[0];
  return `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
}

export function momentLabel(m: MomentView) {
  switch (m.kind) {
    case "mutuals":
      return `${m.listenerCount} mutuals`;
    case "network":
      return "Everyone on teal";
    case "trending":
      return "Trending";
    case "circle":
      return "Heating up";
  }
}

export function momentLine(m: MomentView) {
  switch (m.kind) {
    case "mutuals":
      return `${names(m) ?? `${m.listenerCount} mutuals`} ${m.listenerCount === 1 ? "is" : "are"} on it right now`;
    case "network":
      return `${m.listenerCount} people listening right now`;
    case "trending": {
      const change = m.changePercent && m.changePercent > 0 ? `+${m.changePercent}% today · ` : "";
      return `${change}${m.listenerCount} listeners`;
    }
    case "circle":
      return `${names(m) ?? m.listenerCount} played it today`;
  }
}

/**
 * Editions of one album have different MusicBrainz IDs, so Aqua can return the same
 * album twice. Show it once, under its busiest edition.
 */
export function dedupeMoments<T extends { release: { releaseName: string; artistName?: string } }>(
  moments: T[],
) {
  const seen = new Set<string>();
  return moments.filter((m) => {
    const key = `${m.release.releaseName.toLowerCase()}|${(m.release.artistName ?? "").toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
