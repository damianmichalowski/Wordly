import type { CefrLevel } from '@/src/types/cefr';

/** Krótkie opisy pod słownictwo / daily word (bez fraz ani zdań jako treści nauki). */
export const CEFR_TILE_COPY: Record<CefrLevel, { title: string; subtitle: string }> = {
  A1: {
    title: 'Beginner',
    subtitle: 'Core vocabulary for daily words and basics.',
  },
  A2: {
    title: 'Elementary',
    subtitle: 'Expanding word lists you meet in context.',
  },
  B1: {
    title: 'Intermediate',
    subtitle: 'Broader daily vocabulary and mid-level words.',
  },
  B2: {
    title: 'Upper intermediate',
    subtitle: 'Richer words and finer distinctions.',
  },
  C1: {
    title: 'Advanced',
    subtitle: 'Dense vocabulary and nuance.',
  },
  C2: {
    title: 'Proficiency',
    subtitle: 'Near-native breadth in the word bank.',
  },
};

export const RECOMMENDED_LEVEL: CefrLevel = 'B1';
