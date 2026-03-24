import type { RevisionSessionConfig } from "@/src/types/revisionSession";

export function getSessionScreenTitle(config: RevisionSessionConfig): string {
  switch (config.kind) {
    case "daily":
      return "Powtórka dzienna";
    case "quick":
      return "Szybka sesja";
    case "difficult":
      return "Trudne słowa";
    case "recent":
      return "Ostatnio dodane";
    case "level":
      return `Poziom ${config.level}`;
    case "category":
      return "Kategoria";
    case "custom":
      return "Własna sesja";
  }
}

export function getFlashSessionLabel(config: RevisionSessionConfig): string {
  switch (config.kind) {
    case "daily":
      return "Dziś";
    case "quick":
      return "Szybko";
    case "difficult":
      return "Trudne";
    case "recent":
      return "Świeże";
    case "level":
      return config.level;
    case "category":
      return "Kategoria";
    case "custom":
      return "Sesja";
  }
}
