import { storageKeys } from '@/src/constants/storageKeys';
import { getItem, setItem } from '@/src/services/storage/kvStorage';
import type { UserProfile } from '@/src/types/profile';

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  await setItem(storageKeys.userProfile, JSON.stringify(profile));
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const raw = await getItem(storageKeys.userProfile);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}
