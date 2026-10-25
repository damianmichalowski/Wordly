import { FinalBatch } from "../types";

function escapeCsv(value: string | number) {
  const s = String(value ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

export type CsvRow = {
  target_language: string;
  source_language: string;
  lemma: string;
  ipa: string;
  cefr: string;
  category_codes: string;
  sense_order: number;
  pos: string;
  translation: string;
  example1: string;
  example2: string;
};

export function batchToRows(batch: FinalBatch): CsvRow[] {
  const rows: CsvRow[] = [];
  for (const entry of batch.entries) {
    for (const sense of entry.senses) {
      rows.push({
        target_language: batch.target_language,
        source_language: batch.source_language,
        lemma: entry.lemma,
        ipa: entry.ipa,
        cefr: entry.level,
        category_codes: batch.category ?? "",
        sense_order: sense.sense_order,
        pos: sense.part_of_speech,
        translation: sense.translation.text,
        example1: sense.translation.examples.find((example) => example.example_order === 1)?.text ?? "",
        example2: sense.translation.examples.find((example) => example.example_order === 2)?.text ?? "",
      });
    }
  }
  return rows;
}

export function batchToCsv(batch: FinalBatch) {
  const rows = batchToRows(batch);
  const headers: (keyof CsvRow)[] = [
    "target_language",
    "source_language",
    "lemma",
    "ipa",
    "cefr",
    "category_codes",
    "sense_order",
    "pos",
    "translation",
    "example1",
    "example2",
  ];
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(",")),
  ].join("\n") + "\n";
}
