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

export type AccessibilitySettings = {
  largeText: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
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
