/** Kolejność trudności — wyższy = trudniejszy (wyższy CEFR). */
const ORDER: Record<string, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

/** CEFR-J / niektóre listy używają wariantów (np. Pre-A1). */
export function normalizeCefr(raw: string): string | null {
  const t = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (t === 'PRE-A1' || t === 'PREA1') {
    return 'A1';
  }
  if (ORDER[t] !== undefined) {
    return t;
  }
  return null;
}

export function pickHarderCefr(a: string, b: string): string {
  const na = normalizeCefr(a);
  const nb = normalizeCefr(b);
  if (!na) {
    return nb ?? a;
  }
  if (!nb) {
    return na;
  }
  return (ORDER[na] ?? 0) >= (ORDER[nb] ?? 0) ? na : nb;
}
