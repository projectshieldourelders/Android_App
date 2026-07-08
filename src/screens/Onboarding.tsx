import {
  Accessibility,
  Bell,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  Contrast,
  Eye,
  GraduationCap,
  Image as ImageIcon,
  Languages,
  MessageSquare,
  MousePointerClick,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, TouchableOpacity, View } from 'react-native';

import { privacyFull, privacySummary, termsFull, termsSummary } from '../data/legal';
import { scheduleSafetyReminders } from '../services/notifications';
import { requestAllPermissions } from '../services/permissions';
import { addConfidenceEntry } from '../services/storage';
import { useApp, useTheme } from '../state/AppProvider';
import {
  AiResponseStyle,
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
import { Theme } from '../theme/tokens';

const STEP_COUNT = 7;

// A short baseline knowledge check. Correct answers set the starting lesson
// difficulty (gently) and an initial confidence score.
const baselineQuestions: Array<{ prompt: string; options: string[]; answerIndex: number }> = [
  {
    prompt: 'A text says you must pay a fee in 10 minutes or lose your account. This is most likely…',
    options: ['A real deadline', 'A scam using urgency', 'A normal reminder'],
    answerIndex: 1,
  },
  {
    prompt: 'Your "bank" calls and asks you to read back the code they just texted you. You should…',
    options: ['Read it to them', 'Never share it and hang up', 'Text it instead'],
    answerIndex: 1,
  },
  {
    prompt: 'Which is the safest way to pay a bill?',
    options: ['Gift cards', 'Wire transfer to a stranger', 'A traceable method — never gift cards'],
    answerIndex: 2,
  },
  {
    prompt: 'A link reads "amaz0n-account.com". This is…',
    options: ['The real Amazon', 'A fake look-alike', 'A faster Amazon'],
    answerIndex: 1,
  },
];

function difficultyForScore(correct: number): Difficulty {
  if (correct <= 1) return 'beginner';
  if (correct <= 3) return 'intermediate';
  return 'advanced';
}

export default function Onboarding() {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { prefs: initialPrefs, completeOnboarding, updatePrefs, updateAccessibility } = useApp();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [draft, setDraft] = useState<Preferences>(initialPrefs);
  const [answers, setAnswers] = useState<Array<number | null>>(Array(baselineQuestions.length).fill(null));
  const [permissionsAsked, setPermissionsAsked] = useState(false);
  const [acceptTos, setAcceptTos] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [showTos, setShowTos] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  function patchPrefs(patch: Partial<Preferences>) {
    setDraft((current) => ({ ...current, ...patch }));
    updatePrefs(patch);
  }
  function patchA11y(patch: Partial<Preferences['accessibility']>) {
    setDraft((current) => ({ ...current, accessibility: { ...current.accessibility, ...patch } }));
    updateAccessibility(patch);
  }

  const answered = answers.filter((a) => a !== null).length;
  const correct = answers.reduce((sum: number, a, i) => (a === baselineQuestions[i].answerIndex ? sum + 1 : sum), 0);

  const canContinue = step < STEP_COUNT - 1 ? true : acceptTos && acceptPrivacy;

  async function finish() {
    const tookBaseline = answered > 0;
    const difficulty = tookBaseline ? difficultyForScore(correct) : draft.difficulty;
    const finalPrefs: Preferences = { ...draft, difficulty };
    const survey: CapabilitySurvey | null = tookBaseline
      ? {
          completed: true,
          techComfort: 2,
          scamRecognition: Math.min(4, Math.max(1, correct + 1)),
          phishingFamiliarity: Math.min(4, Math.max(1, correct + 1)),
          preferredDifficulty: difficulty,
        }
      : null;

    completeOnboarding({
      profile: { name: name.trim(), age: age.trim(), createdAt: new Date().toISOString() },
      prefs: finalPrefs,
      survey,
    });
    if (tookBaseline) addConfidenceEntry(Math.round((correct / baselineQuestions.length) * 100));
    scheduleSafetyReminders(finalPrefs.notificationCadence);
    if (!permissionsAsked) requestAllPermissions();
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
            <ChevronLeft size={theme.icon(24)} color={theme.colors.ink} strokeWidth={2.2} />
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
        <StepFade key={step}>
          {step === 0 ? <StepWelcome /> : null}
          {step === 1 ? <StepAbout name={name} setName={setName} age={age} setAge={setAge} /> : null}
          {step === 2 ? <StepPreferences draft={draft} patchPrefs={patchPrefs} /> : null}
          {step === 3 ? <StepAccessibility draft={draft} patchA11y={patchA11y} patchPrefs={patchPrefs} /> : null}
          {step === 4 ? <StepBaseline answers={answers} setAnswers={setAnswers} correct={correct} answered={answered} /> : null}
          {step === 5 ? <StepPermissions asked={permissionsAsked} onAllow={async () => { setPermissionsAsked(true); await requestAllPermissions(); }} /> : null}
          {step === 6 ? (
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
        </StepFade>
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

// Fade + slide-up wrapper; remounts per step (keyed) so it replays each time.
function StepFade({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const a = useRef(new Animated.Value(theme.reducedMotion ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: theme.reducedMotion ? 0 : 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [a, theme.reducedMotion]);
  return (
    <Animated.View style={{ opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

// --- Steps -----------------------------------------------------------------

function StepWelcome() {
  const theme = useTheme();
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (theme.reducedMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float, theme.reducedMotion]);
  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });

  return (
    <View style={{ gap: theme.space.lg, paddingTop: theme.space.xxl, alignItems: 'center' }}>
      <Animated.View
        style={{
          width: theme.tap(104),
          height: theme.tap(104),
          borderRadius: theme.radius.xl,
          backgroundColor: theme.colors.brand,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ translateY }],
          ...theme.shadow('raised'),
        }}
      >
        <ShieldCheck size={theme.icon(56)} color={theme.colors.onBrand} strokeWidth={2} />
      </Animated.View>
      <AppText variant="display" weight="bold" center>
        Welcome to Shield Our Elders
      </AppText>
      <AppText variant="body" tone="inkSoft" center>
        A calm, private helper for when a call, message, or email doesn’t feel right. Let’s set things up your way — it only takes a minute.
      </AppText>
      <Card style={{ width: '100%' }}>
        <Row icon={ShieldCheck} text="Check anything suspicious in seconds" />
        <Row icon={Bell} text="Get clear warnings about possible scams" />
        <Row icon={GraduationCap} text="Learn a little each week — and play games" />
      </Card>
    </View>
  );
}

function Row({ icon: Icon, text }: { icon: typeof ShieldCheck; text: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
      <View style={{ width: theme.tap(42), height: theme.tap(42), borderRadius: theme.radius.sm, backgroundColor: theme.colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={theme.icon(22)} color={theme.colors.brand} strokeWidth={1.9} />
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
        <SectionLabel>How should we explain things?</SectionLabel>
        <SegmentedControl<AiResponseStyle>
          options={[
            { value: 'simple', label: 'Simple' },
            { value: 'balanced', label: 'Balanced' },
            { value: 'detailed', label: 'Detailed' },
          ]}
          value={draft.aiResponseStyle}
          onChange={(value) => patchPrefs({ aiResponseStyle: value })}
        />
        <AppText variant="label" tone="muted">
          "Simple" gives short, plain answers. "Detailed" explains more of the why.
        </AppText>
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

function StepBaseline({
  answers,
  setAnswers,
  correct,
  answered,
}: {
  answers: Array<number | null>;
  setAnswers: (a: Array<number | null>) => void;
  correct: number;
  answered: number;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const done = answered === baselineQuestions.length;
  return (
    <View style={{ gap: theme.space.lg, paddingTop: theme.space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
        <Sparkles size={theme.icon(26)} color={theme.colors.accent} strokeWidth={2} />
        <AppText variant="h1" weight="bold" style={{ flex: 1 }}>
          Quick check
        </AppText>
      </View>
      <AppText variant="body" tone="inkSoft">
        Four quick questions so we can start you at the right level. There is no pass or fail — you can skip it.
      </AppText>

      {baselineQuestions.map((q, qi) => (
        <View key={q.prompt} style={{ gap: theme.space.sm }}>
          <AppText variant="bodySm" weight="semibold">
            {qi + 1}. {q.prompt}
          </AppText>
          {q.options.map((opt, oi) => {
            const chosen = answers[qi] === oi;
            const showResult = answers[qi] !== null;
            const isRight = oi === q.answerIndex;
            return (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.baselineOption,
                  chosen && !showResult && { borderColor: theme.colors.brand },
                  showResult && isRight && { borderColor: theme.colors.low, backgroundColor: theme.colors.lowTint },
                  showResult && chosen && !isRight && { borderColor: theme.colors.danger, backgroundColor: theme.colors.dangerTint },
                ]}
                disabled={answers[qi] !== null}
                onPress={() => {
                  const nextA = [...answers];
                  nextA[qi] = oi;
                  setAnswers(nextA);
                }}
                accessibilityRole="button"
              >
                {answers[qi] !== null && isRight ? (
                  <CheckCircle2 size={theme.icon(20)} color={theme.colors.low} strokeWidth={2.2} />
                ) : answers[qi] !== null && chosen ? (
                  <X size={theme.icon(20)} color={theme.colors.danger} strokeWidth={2.2} />
                ) : null}
                <AppText variant="bodySm" weight="medium" style={{ flex: 1 }}>
                  {opt}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {done ? (
        <Card>
          <AppText variant="h3" weight="bold">
            You got {correct} of {baselineQuestions.length}
          </AppText>
          <AppText variant="bodySm" tone="inkSoft">
            {correct >= 3
              ? 'Great instincts! We’ll start you a little further along — you can change this any time in Settings.'
              : 'Perfect place to start. We’ll begin with the gentle basics and build from there.'}
          </AppText>
        </Card>
      ) : null}
    </View>
  );
}

function StepPermissions({ asked, onAllow }: { asked: boolean; onAllow: () => void }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.space.lg, paddingTop: theme.space.lg }}>
      <AppText variant="h1" weight="bold">
        A few permissions
      </AppText>
      <AppText variant="body" tone="inkSoft">
        These help the app protect you. You can allow them now, and change them any time in your phone’s settings.
      </AppText>

      <Card style={{ gap: theme.space.md }}>
        <PermRow icon={Bell} title="Notifications" body="So we can warn you the moment a check finds a possible scam, plus gentle weekly safety reminders." />
        <PermRow icon={Camera} title="Camera" body="Only used when you choose to scan a QR code before opening it." />
        <PermRow icon={ImageIcon} title="Photos" body="Only used when you pick a screenshot of a suspicious message to check." />
        <PermRow icon={MessageSquare} title="Texts & calls" body="You stay in control — the app never reads these on its own; you paste or upload only what you want checked." />
      </Card>

      <Btn label={asked ? 'Permissions requested ✓' : 'Allow access'} icon={asked ? CheckCircle2 : ShieldCheck} onPress={onAllow} disabled={asked} />
      <AppText variant="label" tone="muted" center>
        Prefer to decide later? Just continue — the app will ask again when a feature needs it.
      </AppText>
    </View>
  );
}

function PermRow({ icon: Icon, title, body }: { icon: typeof Bell; title: string; body: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: theme.space.md }}>
      <View style={{ width: theme.tap(44), height: theme.tap(44), borderRadius: theme.radius.sm, backgroundColor: theme.colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={theme.icon(22)} color={theme.colors.brand} strokeWidth={1.9} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="bodySm" weight="bold">
          {title}
        </AppText>
        <AppText variant="label" tone="muted" style={{ marginTop: 2, lineHeight: theme.lineHeight('label') }}>
          {body}
        </AppText>
      </View>
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
        {checked ? <Check size={theme.icon(18)} color={theme.colors.onBrand} strokeWidth={2.6} /> : null}
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
    baselineOption: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: t.space.sm,
      minHeight: t.tap(52),
      borderWidth: 1.5,
      borderColor: t.colors.line,
      borderRadius: t.radius.md,
      backgroundColor: t.colors.surface,
      paddingHorizontal: t.space.lg,
      paddingVertical: t.space.sm,
    },
  };
}
