import { mapFreeDictPos } from '../posMap';
import type { TranslationRow } from '../types';

/**
 * Parsuje pojedynczy plik `letters/*.xml` ze słownika FreeDict eng-pol
 * (TEI) — wpisy z `<cit type="trans"><quote>…</quote>`.
 * Licencja: GNU GPL 3+ / treść GNU FDL 1.2+ (patrz nagłówek pliku XML).
 */
export function parseEngPolLetterXml(xml: string): TranslationRow[] {
  const out: TranslationRow[] = [];
  const entryRe = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  let em: RegExpExecArray | null;
  while ((em = entryRe.exec(xml)) !== null) {
    const block = em[1];
    const orthM = /<orth>([^<]*)<\/orth>/i.exec(block);
    if (!orthM) {
      continue;
    }
    const lemma = orthM[1].trim();
    if (!lemma) {
      continue;
    }
    const posM = /<gramGrp>\s*<pos>([^<]*)<\/pos>/i.exec(block);
    const pos = mapFreeDictPos(posM?.[1]?.trim() ?? '');

    const citBlocks = [
      ...block.matchAll(/<cit\b[^>]*type\s*=\s*["']trans["'][^>]*>([\s\S]*?)<\/cit>/gi),
    ];
    if (citBlocks.length > 0) {
      for (const cit of citBlocks) {
        const citInner = cit[1];
        for (const qm of citInner.matchAll(/<quote>([^<]*)<\/quote>/gi)) {
          const gloss = decodeXmlEntities(qm[1].trim());
          if (gloss.length > 0) {
            out.push({ lemma, partOfSpeech: pos, glossPl: gloss });
          }
        }
      }
    }
  }
  return out;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
