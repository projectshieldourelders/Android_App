import AsyncStorage from '@react-native-async-storage/async-storage';

import { ConfidenceEntry, TrustedContact } from '../types/app';

const CONTACTS_KEY = 'shield.contacts.v1';
const CONFIDENCE_KEY = 'shield.confidence.v1';
const PHRASE_KEY = 'shield.familyPhrase.v1';

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
