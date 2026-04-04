import type { AchievementEventPayload } from "../types/achievementEvents.types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Parses one event object from RPC `pendingEvents` / `achievement_events` JSON arrays. */
export function parseAchievementEventPayload(raw: unknown): AchievementEventPayload | null {
  if (!isRecord(raw)) return null;
  const defRaw = raw.definition;
  if (!isRecord(defRaw)) return null;

  const eventId = raw.eventId;
  const source = raw.source;
  const createdAt = raw.createdAt;
  const id = defRaw.id;
  if (
    typeof eventId !== "string" ||
    typeof source !== "string" ||
    typeof createdAt !== "string" ||
    typeof id !== "string"
  ) {
    return null;
  }

  return {
    eventId,
    source: source as AchievementEventPayload["source"],
    createdAt,
    achievementDefinitionId:
      typeof raw.achievementDefinitionId === "string"
        ? raw.achievementDefinitionId
        : id,
    code: typeof raw.code === "string" ? raw.code : String(defRaw.code ?? ""),
    type: typeof raw.type === "string" ? raw.type : String(defRaw.type ?? ""),
    threshold: typeof raw.threshold === "number" ? raw.threshold : Number(defRaw.threshold ?? 0),
    title: typeof raw.title === "string" ? raw.title : String(defRaw.title ?? ""),
    description:
      raw.description === null || typeof raw.description === "string"
        ? raw.description
        : (defRaw.description as string | null) ?? null,
    icon:
      raw.icon === null || typeof raw.icon === "string"
        ? raw.icon
        : (defRaw.icon as string | null) ?? null,
    sortOrder:
      typeof raw.sortOrder === "number" ? raw.sortOrder : Number(defRaw.sortOrder ?? 0),
    definition: {
      id,
      code: typeof defRaw.code === "string" ? defRaw.code : "",
      type: typeof defRaw.type === "string" ? defRaw.type : "",
      threshold:
        typeof defRaw.threshold === "number"
          ? defRaw.threshold
          : Number(defRaw.threshold ?? 0),
      title: typeof defRaw.title === "string" ? defRaw.title : "",
      description:
        defRaw.description === null || typeof defRaw.description === "string"
          ? defRaw.description
          : null,
      icon: defRaw.icon === null || typeof defRaw.icon === "string" ? defRaw.icon : null,
      sortOrder:
        typeof defRaw.sortOrder === "number"
          ? defRaw.sortOrder
          : Number(defRaw.sortOrder ?? 0),
    },
  };
}

export function parseAchievementEventPayloadArray(raw: unknown): AchievementEventPayload[] {
  if (!Array.isArray(raw)) return [];
  const out: AchievementEventPayload[] = [];
  for (const item of raw) {
    const parsed = parseAchievementEventPayload(item);
    if (parsed) out.push(parsed);
  }
  return out;
}
