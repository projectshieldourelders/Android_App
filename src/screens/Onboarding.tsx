import {
  Accessibility,
  Bell,
  Check,
  ChevronLeft,
  Contrast,
  Eye,
  GraduationCap,
  Languages,
  MousePointerClick,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';

import { weeklyModules } from '../data/curriculum';
import { privacyFull, privacySummary, termsFull, termsSummary } from '../data/legal';
import { scheduleSafetyReminders } from '../services/notifications';
import { useApp } from '../state/AppProvider';
import {
  AlertSensitivity,
  CapabilitySurvey,
  Difficulty,
  LearningFrequency,
  NotificationCadence,
  Preferences,
  ScalePref,
  ThemePref,
} from '../types/app';
import { AppText, Btn, Card, SectionLabel, SegmentedControl, SwitchRow, TextField, useThemedStyles } from '../ui/kit';
import { useTheme } from '../state/AppProvider';
import { Theme } from '../theme/tokens';

const STEP_COUNT = 6;

export default function Onboarding() {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { prefs: initialPrefs, completeOnboarding, updatePrefs, updateAccessibility } = useApp();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [draft, setDraft] = useState<Preferences>(initialPrefs);
  const [takeSurvey, setTakeSurvey] = useState(false);
  const [survey, setSurvey] = useState<CapabilitySurvey>({
    completed: false,
    techComfort: 2,
    scamRecognition: 2,
    phishingFamiliarity: 2,
    preferredDifficulty: 'beginner',
  });
  const [acceptTos, setAcceptTos] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [showTos, setShowTos] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  // Update local draft + live-preview via context so theme/accessibility apply
  // immediately while the user is still onboarding.
  function patchPrefs(patch: Partial<Preferences>) {
    setDraft((current) => ({ ...current, ...patch }));
    updatePrefs(patch);
  }
  function patchA11y(patch: Partial<Preferences['accessibility']>) {
    setDraft((current) => ({ ...current, accessibility: { ...current.accessibility, ...patch } }));
    updateAccessibility(patch);
  }

  const canContinue = step < STEP_COUNT - 1 ? true : acceptTos && acceptPrivacy;

  function finish() {
    const finalDifficulty = takeSurvey ? survey.preferredDifficulty : draft.difficulty;
    const finalPrefs: Preferences = { ...draft, difficulty: finalDifficulty };
    completeOnboarding({
      profile: { name: name.trim(), age: age.trim(), createdAt: new Date().toISOString() },
      prefs: finalPrefs,
      survey: takeSurvey ? { ...survey, completed: true } : null,
    });
    scheduleSafetyReminders(finalPrefs.notificationCadence);
  }

  function next() {
    if (step === STEP_COUNT - 1) {
      finish();
      return;
    }
    setStep((s) => Math.min(STEP_COUNT - 1, s + 1));
  }

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        {step > 0 ? (
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep((s) => Math.max(0, s - 1))} accessibilityLabel="Go back">
            <ChevronLeft size={theme.icon(24)} color={theme.colors.ink} strokeWidth={2.4} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
        <View style={styles.dots}>
          {Array.from({ length: STEP_COUNT }).map((_, index) => (
            <View key={index} style={[styles.dot, index === step && styles.dotActive, index < step && styles.dotDone]} />
          ))}
        </View>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 0 ? <StepWelcome /> : null}
        {step === 1 ? <StepAbout name={name} setName={setName} age={age} setAge={setAge} /> : null}
        {step === 2 ? <StepPreferences draft={draft} patchPrefs={patchPrefs} /> : null}
        {step === 3 ? <StepAccessibility draft={draft} patchA11y={patchA11y} patchPrefs={patchPrefs} /> : null}
        {step === 4 ? (
          <StepSurvey takeSurvey={takeSurvey} setTakeSurvey={setTakeSurvey} survey={survey} setSurvey={setSurvey} />
        ) : null}
        {step === 5 ? (
          <StepLegal
            acceptTos={acceptTos}
            acceptPrivacy={acceptPrivacy}
            setAcceptTos={setAcceptTos}
            setAcceptPrivacy={setAcceptPrivacy}
            showTos={showTos}
            showPrivacy={showPrivacy}
            setShowTos={setShowTos}
            setShowPrivacy={setShowPrivacy}
          />
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {step === STEP_COUNT - 1 && !canContinue ? (
          <AppText variant="label" tone="muted" center style={{ marginBottom: theme.space.sm }}>
            Please accept both to continue.
          </AppText>
        ) : null}
        <Btn
          label={step === STEP_COUNT - 1 ? 'Get started' : step === 0 ? "Let's begin" : 'Continue'}
          onPress={next}
          disabled={!canContinue}
          icon={step === STEP_COUNT - 1 ? ShieldCheck : undefined}
        />
        {step > 0 && step < STEP_COUNT - 1 ? (
          <TouchableOpacity onPress={next} style={styles.skip} accessibilityRole="button">
            <AppText variant="bodySm" tone="muted" center>
              Skip for now
            </AppText>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

// --- Steps -----------------------------------------------------------------

function StepWelcome() {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.space.lg, paddingTop: theme.space.xl }}>
      <View style={{ width: theme.tap(72), height: theme.tap(72), borderRadius: theme.radius.lg, backgroundColor: theme.colors.brand, alignItems: 'center', justifyContent: 'center' }}>
        <ShieldCheck size={theme.icon(40)} color={theme.colors.onBrand} strokeWidth={2.3} />
      </View>
      <AppText variant="display" weight="bold">
        Welcome to Shield Our Elders
      </AppText>
      <AppText variant="body" tone="inkSoft">
        A calm, private second opinion when a call, message, or email doesn't feel right. Let's set things up the way that works best for you — it only takes a minute.
      </AppText>
      <Card>
        <Row icon={ShieldCheck} text="Check anything suspicious in seconds" />
        <Row icon={Bell} text="Get clear alerts about possible scams" />
        <Row icon={GraduationCap} text="Learn a little each week" />
      </Card>
    </View>
  );
}

function Row({ icon: Icon, text }: { icon: typeof ShieldCheck; text: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
      <View style={{ width: theme.tap(40), height: theme.tap(40), borderRadius: theme.radius.sm, backgroundColor: theme.colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={theme.icon(22)} color={theme.colors.brand} strokeWidth={2.3} />
      </View>
      <AppText variant="bodySm" weight="semibold" style={{ flex: 1 }}>
        {text}
      </AppText>
    </View>
  );
}

function StepAbout({ name, setName, age, setAge }: { name: string; setName: (v: string) => void; age: string; setAge: (v: string) => void }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.space.lg, paddingTop: theme.space.lg }}>
      <AppText variant="h1" weight="bold">
        A little about you
      </AppText>
      <AppText variant="body" tone="inkSoft">
        We use this only to personalize the app on this device. It is never uploaded.
      </AppText>
      <TextField label="What should we call you?" value={name} onChangeText={setName} placeholder="Your first name" autoCapitalize="words" />
      <TextField label="Your age (optional)" value={age} onChangeText={setAge} placeholder="For example, 68" keyboardType="number-pad" />
    </View>
  );
}

function StepPreferences({ draft, patchPrefs }: { draft: Preferences; patchPrefs: (p: Partial<Preferences>) => void }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.space.lg, paddingTop: theme.space.lg }}>
      <AppText variant="h1" weight="bold">
        Your preferences
      </AppText>

      <View style={{ gap: theme.space.sm }}>
        <SectionLabel>Appearance</SectionLabel>
        <SegmentedControl<ThemePref>
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'Automatic' },
          ]}
          value={draft.theme}
          onChange={(value) => patchPrefs({ theme: value })}
        />
      </View>

      <View style={{ gap: theme.space.sm }}>
        <SectionLabel>Safety reminders</SectionLabel>
        <SegmentedControl<NotificationCadence>
          options={[
            { value: 'weekly', label: 'Weekly' },
            { value: 'biweekly', label: 'Every 2 weeks' },
            { value: 'off', label: 'Off' },
          ]}
          value={draft.notificationCadence}
          onChange={(value) => patchPrefs({ notificationCadence: value })}
        />
      </View>

      <View style={{ gap: theme.space.sm }}>
        <SectionLabel>Alert sensitivity</SectionLabel>
        <SegmentedControl<AlertSensitivity>
          options={[
            { value: 'low', label: 'Fewer' },
            { value: 'balanced', label: 'Balanced' },
            { value: 'high', label: 'More' },
          ]}
          value={draft.alertSensitivity}
          onChange={(value) => patchPrefs({ alertSensitivity: value })}
        />
        <AppText variant="label" tone="muted">
          "More" warns you about anything slightly risky. "Fewer" alerts only on stronger signs.
        </AppText>
      </View>

      <View style={{ gap: theme.space.sm }}>
        <SectionLabel>Learning reminders</SectionLabel>
        <SegmentedControl<LearningFrequency>
          options={[
            { value: 'weekly', label: 'Weekly' },
            { value: 'biweekly', label: 'Every 2 weeks' },
            { value: 'off', label: 'Off' },
          ]}
          value={draft.learningFrequency}
          onChange={(value) => patchPrefs({ learningFrequency: value })}
        />
      </View>
    </View>
  );
}

function StepAccessibility({
  draft,
  patchA11y,
  patchPrefs,
}: {
  draft: Preferences;
  patchA11y: (p: Partial<Preferences['accessibility']>) => void;
  patchPrefs: (p: Partial<Preferences>) => void;
}) {
  const theme = useTheme();
  const a = draft.accessibility;
  const scaleOptions: Array<{ value: ScalePref; label: string }> = [
    { value: 'default', label: 'Default' },
    { value: 'large', label: 'Large' },
    { value: 'larger', label: 'Largest' },
  ];
  return (
    <View style={{ gap: theme.space.lg, paddingTop: theme.space.lg }}>
      <AppText variant="h1" weight="bold">
        Make it comfortable
      </AppText>
      <AppText variant="body" tone="inkSoft">
        Adjust anything now, or change it later in Settings. Changes apply right away.
      </AppText>

      <View style={{ gap: theme.space.sm }}>
        <SectionLabel>Text size</SectionLabel>
        <SegmentedControl<ScalePref> options={scaleOptions} value={a.textSize} onChange={(value) => patchA11y({ textSize: value })} />
      </View>
      <View style={{ gap: theme.space.sm }}>
        <SectionLabel>Icon size</SectionLabel>
        <SegmentedControl<ScalePref> options={scaleOptions} value={a.iconSize} onChange={(value) => patchA11y({ iconSize: value })} />
      </View>

      <Card style={{ gap: 0 }}>
        <SwitchRow icon={Contrast} label="High contrast" description="Stronger colors and borders" value={a.highContrast} onValueChange={(v) => patchA11y({ highContrast: v })} />
        <SwitchRow icon={Eye} label="Dark mode" description="Easier on the eyes in low light" value={draft.theme === 'dark'} onValueChange={(v) => patchPrefs({ theme: v ? 'dark' : 'light' })} />
        <SwitchRow icon={Zap} label="Reduce motion" description="Fewer animations" value={a.reduceMotion} onValueChange={(v) => patchA11y({ reduceMotion: v })} />
        <SwitchRow icon={MousePointerClick} label="Larger tap targets" description="Bigger buttons and rows" value={a.largeTapTargets} onValueChange={(v) => patchA11y({ largeTapTargets: v })} />
        <SwitchRow icon={Languages} label="Simple language" description="Shorter, plainer wording" value={a.simplifiedLanguage} onValueChange={(v) => patchA11y({ simplifiedLanguage: v })} />
        <SwitchRow icon={Accessibility} label="Screen reader support" description="Optimized labels for voice-over" value={a.screenReader} onValueChange={(v) => patchA11y({ screenReader: v })} />
      </Card>
    </View>
  );
}

function StepSurvey({
  takeSurvey,
  setTakeSurvey,
  survey,
  setSurvey,
}: {
  takeSurvey: boolean;
  setTakeSurvey: (v: boolean) => void;
  survey: CapabilitySurvey;
  setSurvey: (s: CapabilitySurvey) => void;
}) {
  const theme = useTheme();
  const scale: Array<{ value: string; label: string }> = [
    { value: '1', label: 'New' },
    { value: '2', label: 'A little' },
    { value: '3', label: 'Fairly' },
    { value: '4', label: 'Very' },
  ];
  return (
    <View style={{ gap: theme.space.lg, paddingTop: theme.space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
        <Sparkles size={theme.icon(26)} color={theme.colors.accent} strokeWidth={2.3} />
        <AppText variant="h1" weight="bold" style={{ flex: 1 }}>
          Optional: how do you feel?
        </AppText>
      </View>
      <AppText variant="body" tone="inkSoft">
        There are no wrong answers — this just helps us pick the right starting point for your lessons. You can skip it entirely.
      </AppText>

      <SwitchRow label="Answer a few quick questions" value={takeSurvey} onValueChange={setTakeSurvey} />

      {takeSurvey ? (
        <View style={{ gap: theme.space.lg }}>
          <SurveyItem
            label="How comfortable are you with phones and computers?"
            value={String(survey.techComfort)}
            options={scale}
            onChange={(v) => setSurvey({ ...survey, techComfort: Number(v) })}
          />
          <SurveyItem
            label="How confident are you at spotting scams today?"
            value={String(survey.scamRecognition)}
            options={scale}
            onChange={(v) => setSurvey({ ...survey, scamRecognition: Number(v) })}
          />
          <SurveyItem
            label="How familiar are you with phishing and spoofing?"
            value={String(survey.phishingFamiliarity)}
            options={scale}
            onChange={(v) => setSurvey({ ...survey, phishingFamiliarity: Number(v) })}
          />
          <View style={{ gap: theme.space.sm }}>
            <SectionLabel>Preferred lesson difficulty</SectionLabel>
            <SegmentedControl<Difficulty>
              options={[
                { value: 'beginner', label: 'Gentle' },
                { value: 'intermediate', label: 'Medium' },
                { value: 'advanced', label: 'In-depth' },
              ]}
              value={survey.preferredDifficulty}
              onChange={(value) => setSurvey({ ...survey, preferredDifficulty: value })}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function SurveyItem({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.space.sm }}>
      <AppText variant="bodySm" weight="semibold">
        {label}
      </AppText>
      <SegmentedControl options={options} value={value} onChange={onChange} />
    </View>
  );
}

function StepLegal({
  acceptTos,
  acceptPrivacy,
  setAcceptTos,
  setAcceptPrivacy,
  showTos,
  showPrivacy,
  setShowTos,
  setShowPrivacy,
}: {
  acceptTos: boolean;
  acceptPrivacy: boolean;
  setAcceptTos: (v: boolean) => void;
  setAcceptPrivacy: (v: boolean) => void;
  showTos: boolean;
  showPrivacy: boolean;
  setShowTos: (v: boolean) => void;
  setShowPrivacy: (v: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.space.lg, paddingTop: theme.space.lg }}>
      <AppText variant="h1" weight="bold">
        A few things to agree to
      </AppText>

      <Card>
        <AppText variant="h3" weight="bold">
          Terms of Service
        </AppText>
        {(showTos ? termsFull.split('\n\n') : termsSummary).map((line, i) => (
          <AppText key={i} variant="bodySm" tone="inkSoft">
            {line}
          </AppText>
        ))}
        <TouchableOpacity onPress={() => setShowTos(!showTos)}>
          <AppText variant="bodySm" tone="brand" weight="semibold">
            {showTos ? 'Show less' : 'Read full terms'}
          </AppText>
        </TouchableOpacity>
        <Checkbox label="I understand and accept the Terms of Service" checked={acceptTos} onToggle={() => setAcceptTos(!acceptTos)} />
      </Card>

      <Card>
        <AppText variant="h3" weight="bold">
          Privacy Policy
        </AppText>
        {(showPrivacy ? privacyFull.split('\n\n') : privacySummary).map((line, i) => (
          <AppText key={i} variant="bodySm" tone="inkSoft">
            {line}
          </AppText>
        ))}
        <TouchableOpacity onPress={() => setShowPrivacy(!showPrivacy)}>
          <AppText variant="bodySm" tone="brand" weight="semibold">
            {showPrivacy ? 'Show less' : 'Read full policy'}
          </AppText>
        </TouchableOpacity>
        <Checkbox label="I understand and accept the Privacy Policy" checked={acceptPrivacy} onToggle={() => setAcceptPrivacy(!acceptPrivacy)} />
      </Card>
    </View>
  );
}

function Checkbox({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  const theme = useTheme();
  return (
    <TouchableOpacity
      onPress={onToggle}
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md, minHeight: theme.tap(48), marginTop: theme.space.xs }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          borderWidth: 2,
          alignItems: 'center',
          justifyContent: 'center',
          borderColor: checked ? theme.colors.brand : theme.colors.lineStrong,
          backgroundColor: checked ? theme.colors.brand : 'transparent',
        }}
      >
        {checked ? <Check size={theme.icon(18)} color={theme.colors.onBrand} strokeWidth={3} /> : null}
      </View>
      <AppText variant="bodySm" weight="semibold" style={{ flex: 1 }}>
        {label}
      </AppText>
    </TouchableOpacity>
  );
}

function makeStyles(t: Theme) {
  return {
    root: { flex: 1, backgroundColor: t.colors.bg },
    topBar: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      paddingTop: 54,
      paddingHorizontal: t.space.xl,
      paddingBottom: t.space.sm,
    },
    backBtn: { width: 44, height: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
    dots: { flexDirection: 'row' as const, gap: 6, alignItems: 'center' as const },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.lineStrong },
    dotActive: { width: 22, backgroundColor: t.colors.brand },
    dotDone: { backgroundColor: t.colors.brand },
    content: { paddingHorizontal: t.space.xl, paddingBottom: t.space.xxl, gap: t.space.md },
    footer: {
      padding: t.space.xl,
      paddingBottom: 34,
      borderTopWidth: 1,
      borderTopColor: t.colors.line,
      backgroundColor: t.colors.surface,
    },
    skip: { paddingVertical: t.space.md, marginTop: t.space.xs },
  };
}
