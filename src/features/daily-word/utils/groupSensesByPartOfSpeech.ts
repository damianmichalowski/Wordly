import type { WordSense } from "@/src/features/word-details/types/wordDetails.types";

export type PartOfSpeechGroup = {
  posId: string;
  posName: string;
  /** Najniższy `sense_order` w grupie, kolejność grup = kolejność tłumaczeń. */
  firstSenseOrder: number;
  senses: WordSense[];
};

/**
 * Grupuje sensy po `part_of_speech.id`, sortuje grupy po kolejności tłumaczeń
 * (`sense_order`: pierwsza grupa = POS zawierający najważniejsze tłumaczenie),
 * w grupie, po `sense_order`.
 */
export function groupSensesByPartOfSpeech(
  sensesSortedBySenseOrder: WordSense[],
): PartOfSpeechGroup[] {
  const byPos = new Map<string, WordSense[]>();
  for (const s of sensesSortedBySenseOrder) {
    const id = s.part_of_speech.id;
    const list = byPos.get(id) ?? [];
    list.push(s);
    byPos.set(id, list);
  }
  const groups: PartOfSpeechGroup[] = [];
  for (const [, list] of byPos) {
    if (list.length === 0) {
      continue;
    }
    list.sort((a, b) => a.sense_order - b.sense_order);
    const pos = list[0].part_of_speech;
    groups.push({
      posId: pos.id,
      posName: pos.name,
      firstSenseOrder: list[0].sense_order,
      senses: list,
    });
  }
  groups.sort((a, b) => {
    const d = a.firstSenseOrder - b.firstSenseOrder;
    if (d !== 0) {
      return d;
    }
    return a.posName.localeCompare(b.posName);
  });
  return groups;
}
