import type { WidgetActionType } from '@/src/types/widgets';

type HomeLinkParams = {
  wordId?: string | null;
  stateVersion: number;
  sourceLanguageCode?: string | null;
  targetLanguageCode?: string | null;
  displayLevel?: string | null;
};

const baseScheme = 'wordly://';

export function buildHomeDeepLink(params: HomeLinkParams): string {
  const queryEntries = [
    `source=${encodeURIComponent(params.sourceLanguageCode ?? '')}`,
    `target=${encodeURIComponent(params.targetLanguageCode ?? '')}`,
    `level=${encodeURIComponent(params.displayLevel ?? '')}`,
    `stateVersion=${encodeURIComponent(String(params.stateVersion))}`,
  ];
  if (params.wordId) {
    queryEntries.push(`wordId=${encodeURIComponent(params.wordId)}`);
  }
  return `${baseScheme}home?${queryEntries.join('&')}`;
}

/**
 * Deep link z widgetu iOS (Known).
 * `stateVersion` w query = oczekiwana wersja stanu w momencie tapnięcia (`expectedStateVersion`).
 */
export function buildWidgetActionDeepLink(
  params: HomeLinkParams & { action: WidgetActionType },
): string {
  const base = buildHomeDeepLink(params);
  return `${base}&action=${encodeURIComponent(params.action)}`;
}

export function parseHomeDeepLink(url: string) {
  const [pathPart, queryPart] = url.split('?');
  const route = pathPart.replace('wordly://', '').replace('/', '');
  const searchParams = new Map<string, string>();

  if (queryPart) {
    queryPart.split('&').forEach((entry) => {
      const [rawKey, rawValue] = entry.split('=');
      if (!rawKey) {
        return;
      }
      searchParams.set(decodeURIComponent(rawKey), decodeURIComponent(rawValue ?? ''));
    });
  }

  const rawAction = searchParams.get('action');
  const action: WidgetActionType | null = rawAction === 'known' ? 'known' : null;

  return {
    route,
    wordId: searchParams.get('wordId') ?? null,
    source: searchParams.get('source') ?? null,
    target: searchParams.get('target') ?? null,
    level: searchParams.get('level') ?? null,
    stateVersion: Number(searchParams.get('stateVersion') ?? '0'),
    action,
  };
}
