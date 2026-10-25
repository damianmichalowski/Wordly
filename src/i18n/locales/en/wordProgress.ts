export default {
  wordProgress: {
    a11yMarkDifficult: "Add to difficult words",
    a11yMarkedDifficult: "Marked as difficult",
    a11yUnmarkDifficult: "Remove difficult mark",
    difficultBadge: {
      label: "Difficult",
      progress: "{{current}}/{{total}}",
      symbolOutline: "⚐",
      symbolMarked: "⚑",
    },
    masteryBadge: {
      label: "Mastery",
      complete: "Mastered",
      progress: "{{current}}/{{total}}",
      a11yProgress: "Mastery {{current}} of {{total}}",
      a11yComplete: "Mastered — word will leave difficult list after the session",
    },
  },
} as const;
