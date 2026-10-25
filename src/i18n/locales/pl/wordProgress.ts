export default {
  wordProgress: {
    a11yMarkDifficult: "Dodaj do trudnych",
    a11yMarkedDifficult: "Oznaczone jako trudne",
    a11yUnmarkDifficult: "Usuń oznaczenie trudne",
    difficultBadge: {
      label: "Trudne",
      progress: "{{current}}/{{total}}",
      symbolOutline: "⚐",
      symbolMarked: "⚑",
    },
    masteryBadge: {
      label: "Opanowanie",
      complete: "Opanowane",
      progress: "{{current}}/{{total}}",
      a11yProgress: "Opanowanie {{current}} z {{total}}",
      a11yComplete: "Opanowane — słowo zostanie usunięte z trudnych po sesji",
    },
  },
} as const;
