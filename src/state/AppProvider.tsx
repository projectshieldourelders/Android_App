import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import {
  AccessibilityPrefs,
  CapabilitySurvey,
  DetectionEvent,
  LearningProgress,
  Preferences,
  ScalePref,
  UserProfile,
} from '../types/app';
import {
  advanceStreak,
  clearAllData,
  defaultPreferences,
  defaultProgress,
  loadDetections,
  loadOnboardingComplete,
  loadPreferences,
  loadProfile,
  loadProgress,
  loadSurvey,
  loadWalkthroughSeen,
  saveDetections,
  saveOnboardingComplete,
  savePreferences,
  saveProfile,
  saveProgress,
  saveSurvey,
  saveWalkthroughSeen,
} from '../services/storage';
import { buildTheme, Theme, ThemeMode } from '../theme/tokens';

const scaleValue: Record<ScalePref, number> = {
  default: 1,
  large: 1.16,
  larger: 1.32,
};

interface AppContextValue {
  ready: boolean;
  theme: Theme;
  profile: UserProfile | null;
  prefs: Preferences;
  survey: CapabilitySurvey | null;
  progress: LearningProgress;
  detections: DetectionEvent[];
  unreadCount: number;
  onboardingComplete: boolean;
  updatePrefs: (patch: Partial<Preferences>) => void;
  updateAccessibility: (patch: Partial<AccessibilityPrefs>) => void;
  completeOnboarding: (data: { profile: UserProfile; prefs: Preferences; survey: CapabilitySurvey | null }) => void;
  updateProfile: (profile: UserProfile) => void;
  updateProgress: (progress: LearningProgress) => void;
  recordStreak: () => void;
  pushDetection: (event: DetectionEvent) => void;
  markAllDetectionsRead: () => void;
  clearDetections: () => void;
  walkthroughSeen: boolean;
  markWalkthroughSeen: () => void;
  resetAll: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [ready, setReady] = useState(false);
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [prefs, setPrefsState] = useState<Preferences>(defaultPreferences);
  const [survey, setSurveyState] = useState<CapabilitySurvey | null>(null);
  const [progress, setProgressState] = useState<LearningProgress>(defaultProgress);
  const [detections, setDetectionsState] = useState<DetectionEvent[]>([]);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [walkthroughSeen, setWalkthroughSeen] = useState(true);

  useEffect(() => {
    (async () => {
      const [p, pr, sv, pg, dt, ob, wt] = await Promise.all([
        loadProfile(),
        loadPreferences(),
        loadSurvey(),
        loadProgress(),
        loadDetections(),
        loadOnboardingComplete(),
        loadWalkthroughSeen(),
      ]);
      setProfileState(p);
      setPrefsState(pr);
      setSurveyState(sv);
      setProgressState(pg);
      setDetectionsState(dt);
      setOnboardingComplete(ob);
      setWalkthroughSeen(wt);
      setReady(true);
    })();
  }, []);

  const resolvedMode: ThemeMode = prefs.theme === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : prefs.theme;

  const theme = useMemo(
    () =>
      buildTheme({
        mode: resolvedMode,
        highContrast: prefs.accessibility.highContrast,
        textScale: scaleValue[prefs.accessibility.textSize],
        iconScale: scaleValue[prefs.accessibility.iconSize],
        tapScale: prefs.accessibility.largeTapTargets ? 1.2 : 1,
        reducedMotion: prefs.accessibility.reduceMotion,
      }),
    [resolvedMode, prefs.accessibility],
  );

  const updatePrefs = useCallback((patch: Partial<Preferences>) => {
    setPrefsState((current) => {
      const next = { ...current, ...patch };
      savePreferences(next);
      return next;
    });
  }, []);

  const updateAccessibility = useCallback((patch: Partial<AccessibilityPrefs>) => {
    setPrefsState((current) => {
      const next = { ...current, accessibility: { ...current.accessibility, ...patch } };
      savePreferences(next);
      return next;
    });
  }, []);

  const completeOnboarding = useCallback(
    (data: { profile: UserProfile; prefs: Preferences; survey: CapabilitySurvey | null }) => {
      setProfileState(data.profile);
      setPrefsState(data.prefs);
      setSurveyState(data.survey);
      setOnboardingComplete(true);
      setWalkthroughSeen(false); // show the feature walkthrough + first lesson next
      saveProfile(data.profile);
      savePreferences(data.prefs);
      if (data.survey) saveSurvey(data.survey);
      saveOnboardingComplete(true);
      saveWalkthroughSeen(false);
    },
    [],
  );

  const markWalkthroughSeen = useCallback(() => {
    setWalkthroughSeen(true);
    saveWalkthroughSeen(true);
  }, []);

  const updateProfile = useCallback((next: UserProfile) => {
    setProfileState(next);
    saveProfile(next);
  }, []);

  const updateProgress = useCallback((next: LearningProgress) => {
    setProgressState(next);
    saveProgress(next);
  }, []);

  const recordStreak = useCallback(() => {
    setProgressState((current) => {
      const next = advanceStreak(current);
      if (next !== current) saveProgress(next);
      return next;
    });
  }, []);

  const pushDetection = useCallback((event: DetectionEvent) => {
    setDetectionsState((current) => {
      const next = [event, ...current].slice(0, 50);
      saveDetections(next);
      return next;
    });
  }, []);

  const markAllDetectionsRead = useCallback(() => {
    setDetectionsState((current) => {
      const next = current.map((event) => ({ ...event, read: true }));
      saveDetections(next);
      return next;
    });
  }, []);

  const clearDetections = useCallback(() => {
    setDetectionsState([]);
    saveDetections([]);
  }, []);

  const resetAll = useCallback(() => {
    clearAllData();
    setProfileState(null);
    setPrefsState(defaultPreferences);
    setSurveyState(null);
    setProgressState(defaultProgress);
    setDetectionsState([]);
    setOnboardingComplete(false);
    setWalkthroughSeen(true);
  }, []);

  const unreadCount = useMemo(() => detections.filter((event) => !event.read).length, [detections]);

  const value: AppContextValue = {
    ready,
    theme,
    profile,
    prefs,
    survey,
    progress,
    detections,
    unreadCount,
    onboardingComplete,
    updatePrefs,
    updateAccessibility,
    completeOnboarding,
    updateProfile,
    updateProgress,
    recordStreak,
    pushDetection,
    markAllDetectionsRead,
    clearDetections,
    walkthroughSeen,
    markWalkthroughSeen,
    resetAll,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function useTheme(): Theme {
  return useApp().theme;
}
