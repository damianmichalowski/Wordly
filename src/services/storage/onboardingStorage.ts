import { storageKeys } from '@/src/constants/storageKeys';
import { getItem, removeItem, setItem } from '@/src/services/storage/kvStorage';

export async function isOnboardingComplete(): Promise<boolean> {
  const value = await getItem(storageKeys.onboardingCompleted);
  return value === '1';
}

export async function setOnboardingComplete(): Promise<void> {
  await setItem(storageKeys.onboardingCompleted, '1');
}

/** Tylko do testów / dev: usuwa flagę ukończenia onboardingu. */
export async function clearOnboardingCompletionFlag(): Promise<void> {
  await removeItem(storageKeys.onboardingCompleted);
}
