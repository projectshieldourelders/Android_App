export type RiskLevel = 'low' | 'caution' | 'high' | 'stop';

export type FindingCategory =
  | 'urgency'
  | 'secrecy'
  | 'money'
  | 'identity'
  | 'link'
  | 'device'
  | 'threat'
  | 'payment'
  | 'voice'
  | 'recovery'
  | 'unknown';

export type Finding = {
  id: string;
  title: string;
  detail: string;
  category: FindingCategory;
  points: number;
  severity: RiskLevel;
};

export type AnalysisResult = {
  score: number;
  level: RiskLevel;
  headline: string;
  summary: string;
  findings: Finding[];
  nextSteps: string[];
  script: string;
  matchedTerms: string[];
};

export type AiScamReview = {
  score: number;
  level: RiskLevel;
  headline: string;
  summary: string;
  reasons: string[];
  nextSteps: string[];
  screenshotText?: string;
};

export type HfSpamReview = {
  score: number;
  level: RiskLevel;
  label: string;
  headline: string;
  summary: string;
  reasons: string[];
  nextSteps: string[];
};

export type TrustedContact = {
  id: string;
  label: string;
  name: string;
  phone: string;
};

export type ConfidenceEntry = {
  id: string;
  date: string;
  score: number;
};

export type PracticeExample = {
  id: string;
  channel: string;
  message: string;
  answer: 'safe' | 'suspicious' | 'scam';
  explanation: string;
  redFlags: string[];
};

export type Lesson = {
  id: string;
  title: string;
  minutes: number;
  summary: string;
  steps: string[];
  remember: string;
};

export type ScamAlert = {
  id: string;
  title: string;
  source: string;
  date: string;
  summary: string;
  url: string;
};


// ---------------------------------------------------------------------------
// Product configuration: profile, preferences, accessibility, learning
// ---------------------------------------------------------------------------

export type ThemePref = 'light' | 'dark' | 'system';
export type ScalePref = 'default' | 'large' | 'larger';
export type NotificationCadence = 'off' | 'weekly' | 'biweekly';
export type AlertSensitivity = 'low' | 'balanced' | 'high';
export type LearningFrequency = 'off' | 'weekly' | 'biweekly';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
// How the user wants AI/analysis explanations written.
export type AiResponseStyle = 'simple' | 'balanced' | 'detailed';

export interface AccessibilityPrefs {
  textSize: ScalePref;
  iconSize: ScalePref;
  highContrast: boolean;
  reduceMotion: boolean;
  screenReader: boolean;
  simplifiedLanguage: boolean;
  largeTapTargets: boolean;
}

export interface Preferences {
  theme: ThemePref;
  notificationCadence: NotificationCadence;
  alertSensitivity: AlertSensitivity;
  learningFrequency: LearningFrequency;
  difficulty: Difficulty;
  aiResponseStyle: AiResponseStyle;
  accessibility: AccessibilityPrefs;
}

export interface UserProfile {
  name: string;
  age: string;
  createdAt: string;
}

// Optional, non-judgmental self-assessment. 1 = new to this, 4 = very confident.
export interface CapabilitySurvey {
  completed: boolean;
  techComfort: number;
  scamRecognition: number;
  phishingFamiliarity: number;
  preferredDifficulty: Difficulty;
}

export interface LearningProgress {
  currentWeek: number;
  completedWeeks: string[];
  quizScores: Record<string, number>;
  lastActivity: string;
  // Weekly play streak: number of consecutive weeks with activity.
  streak: number;
  // The week index (weeks since epoch) of the most recent streak activity.
  streakWeek: number;
  // Best streak achieved, for a little extra motivation.
  bestStreak: number;
}

export type DetectionKind = 'call' | 'message' | 'email' | 'link' | 'payment' | 'summary' | 'lesson';

export interface DetectionEvent {
  id: string;
  kind: DetectionKind;
  level: RiskLevel;
  title: string;
  detail: string;
  date: string;
  uncertain?: boolean;
  read?: boolean;
}

export interface CallRiskResult {
  score: number;
  level: RiskLevel;
  headline: string;
  summary: string;
  reasons: string[];
  recommendation: string;
  uncertain: boolean;
}

export interface QuizQuestion {
  prompt: string;
  options: string[];
  answerIndex: number;
  whyCorrect: string;
}

export interface WeeklyModule {
  id: string;
  week: number;
  title: string;
  minutes: number;
  difficulty: Difficulty;
  lesson: string;
  keyPoints: string[];
  example: {
    channel: string;
    message: string;
  };
  explanation: string;
  quiz: QuizQuestion[];
  remember: string;
}
