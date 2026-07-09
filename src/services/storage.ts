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


// ---------------------------------------------------------------------------
// Profile, preferences, onboarding, learning progress, detection history
// ---------------------------------------------------------------------------

import {
  CapabilitySurvey,
  DetectionEvent,
  LearningProgress,
  Preferences,
  UserProfile,
} from '../types/app';

const PROFILE_KEY = 'shield.profile.v1';
const PREFS_KEY = 'shield.prefs.v1';
const ONBOARDING_KEY = 'shield.onboarding.v1';
const PROGRESS_KEY = 'shield.progress.v1';
const DETECTIONS_KEY = 'shield.detections.v1';
const SURVEY_KEY = 'shield.survey.v1';
const WALKTHROUGH_KEY = 'shield.walkthrough.v1';

export const defaultPreferences: Preferences = {
  theme: 'system',
  notificationCadence: 'weekly',
  alertSensitivity: 'balanced',
  learningFrequency: 'weekly',
  difficulty: 'beginner',
  aiResponseStyle: 'balanced',
  accessibility: {
    textSize: 'default',
    iconSize: 'default',
    highContrast: false,
    reduceMotion: false,
    screenReader: false,
    simplifiedLanguage: false,
    largeTapTargets: false,
  },
};

export const defaultProgress: LearningProgress = {
  currentWeek: 1,
  completedWeeks: [],
  quizScores: {},
  lastActivity: '',
  streak: 0,
  streakWeek: 0,
  bestStreak: 0,
};

/** Week index since the Unix epoch (used for weekly streak math). */
export function currentWeekIndex(now: Date = new Date()): number {
  return Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));
}

/**
 * Given the stored progress, return an updated streak after activity today.
 * - Same week as last activity: unchanged.
 * - Exactly the next week: +1.
 * - Otherwise (gap or first ever): reset to 1.
 */
export function advanceStreak(progress: LearningProgress, now: Date = new Date()): LearningProgress {
  const week = currentWeekIndex(now);
  if (progress.streak > 0 && progress.streakWeek === week) return progress;
  const streak = progress.streak > 0 && progress.streakWeek === week - 1 ? progress.streak + 1 : 1;
  return {
    ...progress,
    streak,
    streakWeek: week,
    bestStreak: Math.max(progress.bestStreak ?? 0, streak),
    lastActivity: now.toISOString(),
  };
}

export async function loadPreferences(): Promise<Preferences> {
  const raw = await AsyncStorage.getItem(PREFS_KEY);
  if (!raw) return defaultPreferences;
  try {
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      ...defaultPreferences,
      ...parsed,
      accessibility: { ...defaultPreferences.accessibility, ...(parsed.accessibility ?? {}) },
    };
  } catch {
    return defaultPreferences;
  }
}

export async function savePreferences(prefs: Preferences) {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export async function loadProfile(): Promise<UserProfile | null> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  return raw ? (JSON.parse(raw) as UserProfile) : null;
}

export async function saveProfile(profile: UserProfile) {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export async function loadOnboardingComplete(): Promise<boolean> {
  return (await AsyncStorage.getItem(ONBOARDING_KEY)) === 'true';
}

export async function saveOnboardingComplete(done: boolean) {
  await AsyncStorage.setItem(ONBOARDING_KEY, done ? 'true' : 'false');
}

export async function loadSurvey(): Promise<CapabilitySurvey | null> {
  const raw = await AsyncStorage.getItem(SURVEY_KEY);
  return raw ? (JSON.parse(raw) as CapabilitySurvey) : null;
}

export async function saveSurvey(survey: CapabilitySurvey) {
  await AsyncStorage.setItem(SURVEY_KEY, JSON.stringify(survey));
}

export async function loadProgress(): Promise<LearningProgress> {
  const raw = await AsyncStorage.getItem(PROGRESS_KEY);
  if (!raw) return defaultProgress;
  try {
    return { ...defaultProgress, ...(JSON.parse(raw) as Partial<LearningProgress>) };
  } catch {
    return defaultProgress;
  }
}

export async function saveProgress(progress: LearningProgress) {
  await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

export async function loadDetections(): Promise<DetectionEvent[]> {
  const raw = await AsyncStorage.getItem(DETECTIONS_KEY);
  return raw ? (JSON.parse(raw) as DetectionEvent[]) : [];
}

export async function saveDetections(events: DetectionEvent[]) {
  await AsyncStorage.setItem(DETECTIONS_KEY, JSON.stringify(events.slice(0, 50)));
}

export async function addDetection(event: DetectionEvent): Promise<DetectionEvent[]> {
  const existing = await loadDetections();
  const next = [event, ...existing].slice(0, 50);
  await saveDetections(next);
  return next;
}

export async function loadWalkthroughSeen(): Promise<boolean> {
  return (await AsyncStorage.getItem(WALKTHROUGH_KEY)) === 'true';
}

export async function saveWalkthroughSeen(seen: boolean) {
  await AsyncStorage.setItem(WALKTHROUGH_KEY, seen ? 'true' : 'false');
}

export async function clearAllData() {
  await AsyncStorage.multiRemove([
    CONTACTS_KEY,
    CONFIDENCE_KEY,
    PHRASE_KEY,
    PROFILE_KEY,
    PREFS_KEY,
    ONBOARDING_KEY,
    PROGRESS_KEY,
    DETECTIONS_KEY,
    SURVEY_KEY,
    WALKTHROUGH_KEY,
  ]);
}
