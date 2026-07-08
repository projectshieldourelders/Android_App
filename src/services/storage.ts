import AsyncStorage from '@react-native-async-storage/async-storage';

import { AccessibilitySettings, ConfidenceEntry, TrustedContact } from '../types/app';

const CONTACTS_KEY = 'shield.contacts.v1';
const CONFIDENCE_KEY = 'shield.confidence.v1';
const PHRASE_KEY = 'shield.familyPhrase.v1';
const ACCESSIBILITY_KEY = 'shield.accessibility.v1';

export const defaultAccessibilitySettings: AccessibilitySettings = {
  largeText: false,
  highContrast: false,
  reduceMotion: false,
};

export async function loadContacts(): Promise<TrustedContact[]> {
  const raw = await AsyncStorage.getItem(CONTACTS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveContacts(contacts: TrustedContact[]) {
  await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}

export async function loadConfidence(): Promise<ConfidenceEntry[]> {
  const raw = await AsyncStorage.getItem(CONFIDENCE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function addConfidenceEntry(score: number) {
  const existing = await loadConfidence();
  const next = [
    ...existing.slice(-8),
    {
      id: `${Date.now()}`,
      date: new Date().toISOString(),
      score,
    },
  ];
  await AsyncStorage.setItem(CONFIDENCE_KEY, JSON.stringify(next));
  return next;
}

export async function loadFamilyPhrase() {
  return (await AsyncStorage.getItem(PHRASE_KEY)) ?? '';
}

export async function saveFamilyPhrase(phrase: string) {
  await AsyncStorage.setItem(PHRASE_KEY, phrase);
}

export async function loadAccessibilitySettings(): Promise<AccessibilitySettings> {
  const raw = await AsyncStorage.getItem(ACCESSIBILITY_KEY);
  if (!raw) return defaultAccessibilitySettings;

  try {
    return { ...defaultAccessibilitySettings, ...JSON.parse(raw) };
  } catch {
    return defaultAccessibilitySettings;
  }
}

export async function saveAccessibilitySettings(settings: AccessibilitySettings) {
  await AsyncStorage.setItem(ACCESSIBILITY_KEY, JSON.stringify(settings));
}
