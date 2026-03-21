import { storageKeys } from '@/src/constants/storageKeys';
import { getItem, setItem } from '@/src/services/storage/kvStorage';

export async function isOnboardingComplete(): Promise<boolean> {
  const value = await getItem(storageKeys.onboardingCompleted);
  return value === '1';
}

export async function setOnboardingComplete(): Promise<void> {
  await setItem(storageKeys.onboardingCompleted, '1');
}
