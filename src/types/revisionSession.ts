import type { CefrLevel } from "@/src/types/cefr";

/**
 * Aktywna sesja powtórki (wybór z huba).
 * `category` i `custom` na później (UI może być „wkrótce”).
 */
export type RevisionSessionConfig =
  | { kind: "daily" }
  | { kind: "quick"; count: 5 | 10 | 20 }
  | { kind: "difficult" }
  | { kind: "recent" }
  | { kind: "level"; level: CefrLevel }
  | { kind: "category" }
  | { kind: "custom" };

/** `library`: dotychczasowa biblioteka; `hub`: centrum trybów; `session`: wybrany tryb. */
export type RevisionSessionPhase = "library" | "hub" | "session";
