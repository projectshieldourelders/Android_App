import { StatusBar } from 'expo-status-bar';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import * as SMS from 'expo-sms';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Camera,
  CheckCircle2,
  ChevronRight,
  Circle,
  CreditCard,
  ExternalLink,
  FileAudio,
  GraduationCap,
  ChevronLeft,
  LayoutGrid,
  LifeBuoy,
  Link as LinkIcon,
  Lock,
  Mail,
  MessageCircle,
  Mic,
  Newspaper,
  Phone,
  PhoneCall,
  QrCode,
  Search,
  Settings as SettingsIcon,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Trophy,
  Upload,
  Users,
  X,
  House,
  Info,
  Menu,
  Puzzle,
  PhoneOff,
  Ban,
  KeyRound,
  MonitorOff,
  Shuffle,
  Grid3x3,
  ToggleLeft,
  PenLine,
  Flag,
  Brain,
  Flame,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  KeyboardAvoidingView,
  LogBox,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { DimensionValue, ImageStyle } from 'react-native';

import { practiceExamples, recoverySteps, trustedContactMessage } from './src/data/content';
import { daysUntilUnlock, isWeekUnlocked, weeklyModules } from './src/data/curriculum';
import { isAiReviewConfigured, reviewScamWithAi } from './src/services/aiScamReview';
import { analyzeCallRisk } from './src/services/callRisk';
import {
  isHfOcrConfigured,
  isHfTranscriptionConfigured,
  readScreenshotTextWithHuggingFace,
  transcribeAudioWithHuggingFace,
} from './src/services/huggingFaceMedia';
import { checkSpamWithHuggingFace, isHfSpamCheckConfigured } from './src/services/huggingFaceSpam';
import { fetchScamAlerts } from './src/services/news';
import { notifyDetection } from './src/services/notifications';
import { getCachedSpam, normalizeForCheck, redactForModel, setCachedSpam, shouldEscalateToModel } from './src/services/riskGate';
import {
  analyzeCallChecklist,
  analyzeMessage,
  analyzePayments,
  analyzeUrl,
  analyzeVoiceClone,
  labelForLevel,
} from './src/services/scamAnalyzer';
import { addConfidenceEntry, loadConfidence, loadContacts, loadFamilyPhrase, saveContacts, saveFamilyPhrase } from './src/services/storage';
import Onboarding from './src/screens/Onboarding';
import Settings from './src/screens/Settings';
import { AppProvider, useApp, useTheme } from './src/state/AppProvider';
import { Theme } from './src/theme/tokens';
import {
  AiScamReview,
  AlertSensitivity,
  AnalysisResult,
  CallRiskResult,
  ConfidenceEntry,
  DetectionEvent,
  DetectionKind,
  HfSpamReview,
  RiskLevel,
  ScamAlert,
  TrustedContact,
  WeeklyModule,
} from './src/types/app';
import {
  buildCrossword,
  crosswordClues,
  crosswordSize,
  fillBlankItems,
  key as cellKey,
  matchPairs,
  memoryTerms,
  redFlagItems,
  scrambleWords,
  shuffle,
  trueFalseItems,
} from './src/data/games';
import { requestAllPermissions } from './src/services/permissions';
import { AnimatedToggle, Btn, Card, ListRow } from './src/ui/kit';

LogBox.ignoreLogs(['Cannot connect to Expo CLI']);

type Screen =
  | 'home'
  | 'tools'
  | 'scam'
  | 'call'
  | 'emergency'
  | 'contacts'
  | 'link'
  | 'qr'
  | 'voice'
  | 'payment'
  | 'news'
  | 'learn'
  | 'practice'
  | 'recovery'
  | 'phone'
  | 'voicemail'
  | 'activity'
  | 'settings'
  | 'lesson'
  | 'games';

type ToggleState = Record<string, boolean>;

const initialCallAnswers: ToggleState = { money: false, secret: false, code: false, remote: false, threat: false, callerId: false };
const initialVoiceAnswers: ToggleState = { family: false, money: false, secret: false, emotional: false };
const initialPayments: ToggleState = { giftCard: false, crypto: false, wire: false, zelle: false, cashApp: false, venmo: false, bankCard: false };

const screenTitles: Record<Screen, string> = {
  home: 'Start',
  tools: 'Checks',
  scam: 'Message or Email',
  call: 'Phone Call',
  emergency: 'Emergency',
  contacts: 'People to Call',
  link: 'Link',
  qr: 'QR Code',
  voice: 'Family Voice',
  payment: 'Before You Pay',
  news: 'Scam Alerts',
  learn: 'Learn',
  practice: 'Quiz',
  recovery: 'Help After a Scam',
  phone: 'Check a Number',
  voicemail: 'Voicemail',
  activity: 'Notifications',
  settings: 'Settings',
  lesson: 'Lesson',
  games: 'Games',
};

type ToolAction = { screen: Screen; label: string; detail: string; icon: LucideIcon; tone?: RiskLevel };

type ToolGroup = { title: string; subtitle: string; icon: LucideIcon; items: ToolAction[] };

const toolGroups: ToolGroup[] = [
  {
    title: 'Something you received',
    subtitle: 'A text, email, or call',
    icon: MessageCircle,
    items: [
      { screen: 'scam', label: 'Message or email', detail: 'Paste the words and check them', icon: MessageCircle },
      { screen: 'call', label: 'Phone call', detail: 'Answer a few yes / no questions', icon: PhoneCall },
      { screen: 'voicemail', label: 'Voicemail', detail: 'Check what was left on your phone', icon: FileAudio },
    ],
  },
  {
    title: 'Before you open or tap',
    subtitle: 'Links, codes, and numbers',
    icon: LinkIcon,
    items: [
      { screen: 'link', label: 'A link', detail: 'Check the address first', icon: LinkIcon },
      { screen: 'qr', label: 'A QR code', detail: 'Preview where it really goes', icon: QrCode },
      { screen: 'phone', label: 'A phone number', detail: 'Check for spoofing', icon: Search },
    ],
  },
  {
    title: 'Money and family',
    subtitle: 'Payments and urgent calls',
    icon: CreditCard,
    items: [
      { screen: 'payment', label: 'Before you pay', detail: 'Check how they want to be paid', icon: CreditCard },
      { screen: 'voice', label: 'A family emergency call', detail: 'Use your family phrase', icon: Mic },
      { screen: 'recovery', label: 'I already clicked or paid', detail: 'Steps to recover', icon: LifeBuoy, tone: 'high' },
    ],
  },
];

const homeQuickChecks: ToolAction[] = [
  { screen: 'scam', label: 'Message', detail: 'Text or email', icon: MessageCircle },
  { screen: 'call', label: 'Call', detail: 'Yes / no check', icon: PhoneCall },
  { screen: 'link', label: 'Link', detail: 'Before you tap', icon: LinkIcon },
  { screen: 'phone', label: 'Number', detail: 'Check spoofing', icon: Search },
  { screen: 'payment', label: 'Payment', detail: 'Before you pay', icon: CreditCard },
  { screen: 'tools', label: 'More', detail: 'All checks', icon: LayoutGrid },
];

// --- Theme-aware risk color helpers ---------------------------------------

function levelColor(t: Theme, level: RiskLevel): string {
  switch (level) {
    case 'stop':
      return t.colors.danger;
    case 'high':
      return t.colors.high;
    case 'caution':
      return t.colors.warn;
    default:
      return t.colors.brand;
  }
}

function levelBg(t: Theme, level: RiskLevel): string {
  switch (level) {
    case 'stop':
      return t.colors.dangerTint;
    case 'high':
      return t.colors.highTint;
    case 'caution':
      return t.colors.warnTint;
    default:
      return t.colors.brandTint;
  }
}

function shouldAlert(level: RiskLevel, sensitivity: AlertSensitivity): boolean {
  if (sensitivity === 'high') return level === 'caution' || level === 'high' || level === 'stop';
  if (sensitivity === 'low') return level === 'stop';
  return level === 'high' || level === 'stop';
}

function formatDate(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatWhen(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, '');
}

// ---------------------------------------------------------------------------
// Root: provider + onboarding gate
// ---------------------------------------------------------------------------

export default function App() {
  return (
    <AppProvider>
      <Root />
    </AppProvider>
  );
}

function Root() {
  const { ready, onboardingComplete, theme } = useApp();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg }}>
        <ActivityIndicator size="large" color={theme.colors.brand} />
      </View>
    );
  }

  if (!onboardingComplete) {
    return (
      <>
        <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
        <Onboarding />
      </>
    );
  }

  return <MainApp />;
}


// ---------------------------------------------------------------------------
// Main application
// ---------------------------------------------------------------------------

function MainApp() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { profile, prefs, progress, detections, unreadCount, pushDetection, markAllDetectionsRead, walkthroughSeen, markWalkthroughSeen, recordStreak } = useApp();

  const scrollRef = useRef<ScrollView>(null);
  const screenAnim = useRef(new Animated.Value(1)).current;
  const [screen, setScreen] = useState<Screen>('home');
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [confidence, setConfidence] = useState<ConfidenceEntry[]>([]);
  const [familyPhrase, setFamilyPhrase] = useState('');
  const [alerts, setAlerts] = useState<ScamAlert[]>([]);
  const [messageText, setMessageText] = useState('');
  const [messageChecked, setMessageChecked] = useState(false);
  const [screenshotUri, setScreenshotUri] = useState('');
  const [screenshotBase64, setScreenshotBase64] = useState('');
  const [screenshotMimeType, setScreenshotMimeType] = useState('image/jpeg');
  const [voicemailTranscript, setVoicemailTranscript] = useState('');
  const [voicemailFile, setVoicemailFile] = useState('');
  const [voicemailUri, setVoicemailUri] = useState('');
  const [voicemailMimeType, setVoicemailMimeType] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [ocrError, setOcrError] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState('');
  const [transcriptionLoading, setTranscriptionLoading] = useState(false);
  const [aiReview, setAiReview] = useState<AiScamReview | null>(null);
  const [aiReviewError, setAiReviewError] = useState('');
  const [aiReviewLoading, setAiReviewLoading] = useState(false);
  const [hfSpamReview, setHfSpamReview] = useState<HfSpamReview | null>(null);
  const [hfSpamError, setHfSpamError] = useState('');
  const [hfSpamNotice, setHfSpamNotice] = useState('');
  const [hfSpamLoading, setHfSpamLoading] = useState(false);
  const hfSpamRequestInFlight = useRef(false);
  const [callAnswers, setCallAnswers] = useState<ToggleState>(initialCallAnswers);
  const [voiceAnswers, setVoiceAnswers] = useState<ToggleState>(initialVoiceAnswers);
  const [paymentAnswers, setPaymentAnswers] = useState<ToggleState>(initialPayments);
  const [urlText, setUrlText] = useState('');
  const [qrValue, setQrValue] = useState('');
  const [scanning, setScanning] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [claimedIdentity, setClaimedIdentity] = useState('');
  const [callRisk, setCallRisk] = useState<CallRiskResult | null>(null);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [aboutVisible, setAboutVisible] = useState(false);
  const [game, setGame] = useState<'none' | 'scramble' | 'match' | 'crossword' | 'truefalse' | 'fillblank' | 'redflag' | 'memory'>('none');
  const [contactDrafts, setContactDrafts] = useState<TrustedContact[]>([
    { id: 'contact-1', label: 'Trusted Contact 1', name: '', phone: '' },
    { id: 'contact-2', label: 'Trusted Contact 2', name: '', phone: '' },
  ]);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [selectedPractice, setSelectedPractice] = useState<'safe' | 'suspicious' | 'scam' | null>(null);
  const [practiceStats, setPracticeStats] = useState({ correct: 0, answered: 0 });
  const [emergencyVisible, setEmergencyVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  useEffect(() => {
    async function hydrate() {
      const [storedContacts, storedConfidence, storedPhrase, storedAlerts] = await Promise.all([
        loadContacts(),
        loadConfidence(),
        loadFamilyPhrase(),
        fetchScamAlerts(),
      ]);
      setContacts(storedContacts);
      setContactDrafts([
        storedContacts[0] ?? { id: 'contact-1', label: 'Trusted Contact 1', name: '', phone: '' },
        storedContacts[1] ?? { id: 'contact-2', label: 'Trusted Contact 2', name: '', phone: '' },
      ]);
      setConfidence(storedConfidence);
      setFamilyPhrase(storedPhrase);
      setAlerts(storedAlerts);
    }
    hydrate();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    if (theme.reducedMotion) {
      screenAnim.setValue(1);
      return;
    }
    screenAnim.setValue(0);
    Animated.timing(screenAnim, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [screen, screenAnim, theme.reducedMotion]);

  const scamResult = useMemo(
    () => analyzeMessage([messageText, voicemailTranscript].filter(Boolean).join('\n'), 'message or email'),
    [messageText, voicemailTranscript],
  );
  const callResult = useMemo(() => analyzeCallChecklist(callAnswers), [callAnswers]);
  const voiceResult = useMemo(() => analyzeVoiceClone(voiceAnswers, familyPhrase), [voiceAnswers, familyPhrase]);
  const paymentResult = useMemo(() => analyzePayments(paymentAnswers), [paymentAnswers]);
  const linkResult = useMemo(() => analyzeUrl(urlText), [urlText]);
  const qrResult = useMemo(() => analyzeUrl(qrValue), [qrValue]);

  const hasScamInput = Boolean(messageText.trim() || voicemailTranscript.trim());
  const hasMessageReviewInput = Boolean(messageText.trim() || voicemailTranscript.trim() || screenshotBase64);
  const hfSpamInputText = [messageText, voicemailTranscript].filter(Boolean).join('\n');
  const hasHfTextInput = Boolean(hfSpamInputText.trim());
  const hasCallAnswers = Object.values(callAnswers).some(Boolean);
  const hasVoiceAnswers = Object.values(voiceAnswers).some(Boolean);
  const hasPaymentAnswers = Object.values(paymentAnswers).some(Boolean);
  const hasUrlInput = Boolean(urlText.trim());
  const hasQrInput = Boolean(qrValue.trim());
  const hasPhoneInput = Boolean(phoneNumber.trim());
  const hasVoicemailInput = Boolean(voicemailTranscript.trim());
  const storedConfidence = confidence.at(-1)?.score ?? 0;
  const quizScore = practiceStats.answered ? Math.round((practiceStats.correct / practiceStats.answered) * 100) : storedConfidence;
  const practice = practiceExamples[practiceIndex % practiceExamples.length];
  const practiceNumber = (practiceIndex % practiceExamples.length) + 1;

  const recordDetection = useCallback(
    (kind: DetectionKind, level: RiskLevel, title: string, detail: string, uncertain?: boolean) => {
      if (!shouldAlert(level, prefs.alertSensitivity)) return;
      const event: DetectionEvent = {
        id: `d-${Date.now()}`,
        kind,
        level,
        title,
        detail,
        date: new Date().toISOString(),
        uncertain,
      };
      pushDetection(event);
      notifyDetection(event);
    },
    [prefs.alertSensitivity, pushDetection],
  );

  function navigate(next: Screen) {
    if (next === screen) return;
    setScreen(next);
    if (next !== 'qr') setScanning(false);
    if (next !== 'games') setGame('none');
    if (next === 'activity') markAllDetectionsRead();
  }

  function openLesson(moduleId: string) {
    setActiveModuleId(moduleId);
    setScreen('lesson');
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  function startWalkthroughLesson() {
    markWalkthroughSeen();
    const first = weeklyModules[0];
    if (first) openLesson(first.id);
  }

  async function refreshAlerts() {
    setAlerts(await fetchScamAlerts());
  }

  async function pickScreenshot() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to attach a screenshot.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.85, base64: true });
    if (!result.canceled) {
      setScreenshotUri(result.assets[0].uri);
      setScreenshotBase64(result.assets[0].base64 ?? '');
      setScreenshotMimeType(result.assets[0].mimeType ?? 'image/jpeg');
      setAiReview(null);
      setAiReviewError('');
      setOcrText('');
      setOcrError('');
    }
  }

  function updateMessageText(value: string) {
    setMessageText(value);
    setMessageChecked(false);
    setAiReview(null);
    setAiReviewError('');
    setHfSpamReview(null);
    setHfSpamError('');
    setHfSpamNotice('');
    setOcrError('');
  }

  function updateVoicemailTranscript(value: string) {
    setVoicemailTranscript(value);
    setMessageChecked(false);
    setAiReview(null);
    setAiReviewError('');
    setHfSpamReview(null);
    setHfSpamError('');
    setHfSpamNotice('');
    setTranscriptionError('');
  }

  function clearMessageCheck() {
    setMessageText('');
    setVoicemailTranscript('');
    setScreenshotUri('');
    setScreenshotBase64('');
    setScreenshotMimeType('image/jpeg');
    setVoicemailFile('');
    setVoicemailUri('');
    setVoicemailMimeType('');
    setOcrText('');
    setOcrError('');
    setTranscriptionError('');
    setAiReview(null);
    setAiReviewError('');
    setHfSpamReview(null);
    setHfSpamError('');
    setHfSpamNotice('');
    setMessageChecked(false);
  }

  async function runScreenshotOcr() {
    if (!screenshotBase64) {
      Alert.alert('Add a screenshot first', 'Choose a screenshot before reading it.');
      return;
    }
    setOcrLoading(true);
    setOcrError('');
    try {
      const text = await readScreenshotTextWithHuggingFace(screenshotBase64, screenshotMimeType);
      setOcrText(text);
      setMessageText((current) => (current.trim() ? `${current.trim()}\n${text}` : text));
      setAiReview(null);
      setHfSpamReview(null);
      setHfSpamNotice('');
    } catch (error) {
      setOcrText('');
      setOcrError(error instanceof Error ? error.message : 'Screenshot reading failed.');
    } finally {
      setOcrLoading(false);
    }
  }

  async function runAudioTranscription() {
    if (!voicemailUri) {
      Alert.alert('Upload audio first', 'Choose a voicemail audio file before transcribing.');
      return;
    }
    setTranscriptionLoading(true);
    setTranscriptionError('');
    try {
      const text = await transcribeAudioWithHuggingFace(voicemailUri, voicemailMimeType || 'audio/mpeg');
      setVoicemailTranscript((current) => (current.trim() ? `${current.trim()}\n${text}` : text));
      setAiReview(null);
      setHfSpamReview(null);
      setHfSpamNotice('');
    } catch (error) {
      setTranscriptionError(error instanceof Error ? error.message : 'Audio transcription failed.');
    } finally {
      setTranscriptionLoading(false);
    }
  }

  // Cost-optimized SMS spam check: cache first, redact + cap before sending.
  async function runHfSpamCheck() {
    const input = hfSpamInputText.trim();
    if (!input) {
      Alert.alert('Paste words first', 'This spam model checks pasted text, not screenshots.');
      return;
    }
    const cached = getCachedSpam(input);
    if (cached) {
      setHfSpamReview(cached);
      setHfSpamError('');
      setHfSpamNotice('Showing your saved result for this message.');
      return;
    }
    if (hfSpamRequestInFlight.current) {
      setHfSpamNotice('This message is already being checked.');
      return;
    }
    hfSpamRequestInFlight.current = true;
    setHfSpamLoading(true);
    setHfSpamError('');
    setHfSpamNotice('');
    try {
      const review = await checkSpamWithHuggingFace(redactForModel(input));
      setCachedSpam(input, review);
      setHfSpamReview(review);
      if (review.level === 'high' || review.level === 'stop') {
        recordDetection('message', review.level, review.headline, review.summary);
      }
    } catch (error) {
      setHfSpamReview(null);
      setHfSpamError(error instanceof Error ? error.message : 'SMS spam check failed.');
    } finally {
      hfSpamRequestInFlight.current = false;
      setHfSpamLoading(false);
    }
  }

  // Local-first message check: run cheap heuristics, log a detection when
  // risky, and only escalate to the paid model when genuinely uncertain.
  function runMessageCheck() {
    if (!hasMessageReviewInput) {
      Alert.alert('Add something to check', 'Paste a message, or attach a screenshot and read it first.');
      return;
    }
    setMessageChecked(true);
    const text = hfSpamInputText.trim();
    if (!text) return;
    const local = analyzeMessage(text, 'message or email');
    if (local.level === 'high' || local.level === 'stop') {
      recordDetection('message', local.level, local.headline, local.summary);
    }
    if (isHfSpamCheckConfigured() && shouldEscalateToModel(local, normalizeForCheck(text))) {
      runHfSpamCheck();
    }
  }

  async function runAiReview() {
    if (!hasMessageReviewInput) {
      Alert.alert('Add something to check', 'Paste a message or attach a screenshot first.');
      return;
    }
    setAiReviewLoading(true);
    setAiReviewError('');
    try {
      const review = await reviewScamWithAi({ messageText, transcript: voicemailTranscript, screenshotBase64, localResult: scamResult });
      setAiReview(review);
      if (review.level === 'high' || review.level === 'stop') {
        recordDetection('message', review.level, review.headline, review.summary);
      }
    } catch (error) {
      setAiReview(null);
      setAiReviewError(error instanceof Error ? error.message : 'AI review failed.');
    } finally {
      setAiReviewLoading(false);
    }
  }

  function runCallRiskCheck() {
    if (!hasPhoneInput) {
      Alert.alert('Enter a number', 'Add the incoming phone number to check it.');
      return;
    }
    const result = analyzeCallRisk({ number: phoneNumber, claimedIdentity: claimedIdentity.trim() || undefined });
    setCallRisk(result);
    if (result.level === 'high' || result.level === 'stop') {
      recordDetection('call', result.level, result.headline, result.summary, result.uncertain);
    }
  }

  async function pickVoicemail() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['audio/*', 'text/*'], copyToCacheDirectory: true, multiple: false });
    if (!result.canceled) {
      setVoicemailFile(result.assets[0].name);
      setVoicemailUri(result.assets[0].uri);
      setVoicemailMimeType(result.assets[0].mimeType ?? 'audio/mpeg');
      setTranscriptionError('');
    }
  }

  async function persistContacts(next: TrustedContact[]) {
    const usable = next.filter((contact) => contact.name.trim() || contact.phone.trim()).slice(0, 2);
    setContacts(usable);
    await saveContacts(usable);
  }

  async function saveContactDraft(index: number) {
    const normalized = contactDrafts.map((contact, contactIndex) =>
      contactIndex === index ? { ...contact, name: contact.name.trim(), phone: contact.phone.trim() } : contact,
    );
    setContactDrafts(normalized);
    await persistContacts(normalized);
    Alert.alert('Saved', 'Trusted contact saved on this device.');
  }

  async function savePhrase() {
    await saveFamilyPhrase(familyPhrase.trim());
    setFamilyPhrase(familyPhrase.trim());
    Alert.alert('Saved', 'Family verification phrase saved on this device.');
  }

  function callContact(contact: TrustedContact) {
    const phone = normalizePhone(contact.phone);
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  }

  async function textContact(contact: TrustedContact) {
    const phone = normalizePhone(contact.phone);
    if (!phone) return;
    const available = await SMS.isAvailableAsync();
    if (available) {
      await SMS.sendSMSAsync([phone], trustedContactMessage);
    } else {
      const separator = Platform.OS === 'ios' ? '&' : '?';
      Linking.openURL(`sms:${phone}${separator}body=${encodeURIComponent(trustedContactMessage)}`);
    }
  }

  async function choosePractice(choice: 'safe' | 'suspicious' | 'scam') {
    if (selectedPractice) return;
    setSelectedPractice(choice);
    const correct = choice === practice.answer ? practiceStats.correct + 1 : practiceStats.correct;
    const answered = practiceStats.answered + 1;
    setPracticeStats({ correct, answered });
    setConfidence(await addConfidenceEntry(Math.round((correct / answered) * 100)));
    recordStreak();
  }

  function nextPractice() {
    setSelectedPractice(null);
    setPracticeIndex((current) => current + 1);
  }

  function restartPractice() {
    setSelectedPractice(null);
    setPracticeStats({ correct: 0, answered: 0 });
    setPracticeIndex(0);
  }

  function onQrScanned(result: BarcodeScanningResult) {
    setQrValue(result.data);
    setScanning(false);
  }

  function openUrl(raw: string) {
    const safeRaw = raw.trim();
    if (!safeRaw) return;
    const target = /^https?:\/\//i.test(safeRaw) ? safeRaw : `https://${safeRaw}`;
    Linking.openURL(target);
  }

  function openSearchForPhone() {
    Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(`${phoneNumber} scam report`)}`);
  }


  function renderHeader() {
    const bell = (
      <TouchableOpacity
        style={styles.headerIconBtn}
        onPress={() => {
          setNotificationsVisible(true);
          markAllDetectionsRead();
        }}
        activeOpacity={0.7}
        accessibilityLabel={`Notifications${unreadCount ? `, ${unreadCount} new` : ''}`}
      >
        <Bell size={theme.icon(26)} color={theme.colors.ink} strokeWidth={1.9} />
        {unreadCount ? (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );

    if (screen === 'home') {
      const greeting = profile?.name ? `Hi, ${profile.name}` : 'Welcome';
      return (
        <View style={styles.header}>
          <View style={styles.homeHeaderRow}>
            <View style={styles.logoMark}>
              <ShieldCheck size={theme.icon(28)} color={theme.colors.onBrand} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.brandName} numberOfLines={1}>
                {greeting}
              </Text>
              <Text style={styles.brandTagline} numberOfLines={1}>
                Shield Our Elders
              </Text>
            </View>
            {bell}
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => setMenuVisible(true)} activeOpacity={0.7} accessibilityLabel="Menu and settings">
              <Menu size={theme.icon(26)} color={theme.colors.ink} strokeWidth={1.9} />
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    const backTo: Screen = screen === 'lesson' ? 'learn' : screen === 'practice' ? 'games' : 'home';
    const backLabel = backTo === 'learn' ? 'Learn' : backTo === 'games' ? 'Games' : 'Home';
    return (
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigate(backTo)} activeOpacity={0.7} accessibilityLabel={`Back to ${backLabel}`}>
              <ChevronLeft size={theme.icon(24)} color={theme.colors.brand} strokeWidth={2.4} />
              <Text style={styles.backText}>{backLabel}</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{screenTitles[screen]}</Text>
          </View>
          {bell}
        </View>
      </View>
    );
  }

  function renderBottomNav() {
    const items: Array<{ screen: Screen; label: string; icon: LucideIcon }> = [
      { screen: 'home', label: 'Home', icon: House },
      { screen: 'tools', label: 'Checks', icon: ShieldCheck },
      { screen: 'learn', label: 'Learn', icon: GraduationCap },
      { screen: 'games', label: 'Games', icon: Puzzle },
      { screen: 'recovery', label: 'Recover', icon: LifeBuoy },
    ];
    const activeTab: Screen = screen === 'lesson' ? 'learn' : screen === 'practice' ? 'games' : screen;
    return (
      <View style={styles.bottomNav}>
        {items.map((item) => (
          <NavItem key={item.screen} icon={item.icon} label={item.label} active={activeTab === item.screen} onPress={() => navigate(item.screen)} />
        ))}
      </View>
    );
  }

  function renderHome() {
    const modules = weeklyModules;
    const createdAt = profile?.createdAt ?? new Date().toISOString();
    const nextLesson =
      modules.find((m) => isWeekUnlocked(createdAt, m.week) && !progress.completedWeeks.includes(m.id)) ??
      modules.find((m) => !progress.completedWeeks.includes(m.id)) ??
      modules[modules.length - 1];
    const nextUnlocked = nextLesson ? isWeekUnlocked(createdAt, nextLesson.week) : false;

    return (
      <View style={styles.homeStack}>
        {/* Big, clear help button — the most important action */}
        <Reveal delay={0}>
          <TouchableOpacity
            style={styles.emergencyButton}
            activeOpacity={0.9}
            onPress={() => {
              setEmergencyVisible(true);
              navigate('emergency');
            }}
            accessibilityRole="button"
            accessibilityLabel="I think this is a scam. Show safety steps."
          >
            <View style={styles.emergencyIcon}>
              <Siren size={theme.icon(34)} color={theme.colors.onBrand} strokeWidth={2.6} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.emergencyTitle}>I think this is a scam</Text>
              <Text style={styles.emergencySub}>Tap for safety steps</Text>
            </View>
            <ChevronRight size={theme.icon(28)} color={theme.colors.onBrand} strokeWidth={2.6} />
          </TouchableOpacity>
        </Reveal>

        {/* Streak chip — encourages weekly play */}
        {progress.streak > 0 ? (
          <Reveal delay={60}>
            <TouchableOpacity style={styles.homeStreakChip} onPress={() => navigate('games')} activeOpacity={0.85} accessibilityRole="button">
              <View style={styles.homeStreakIcon}>
                <Flame size={theme.icon(22)} color={theme.colors.onBrand} strokeWidth={2} />
              </View>
              <Text style={styles.homeStreakText}>{progress.streak}-week streak — keep it going!</Text>
              <ChevronRight size={theme.icon(20)} color={theme.colors.brand} strokeWidth={2.2} />
            </TouchableOpacity>
          </Reveal>
        ) : null}

        {/* Check something — big icon-first tiles */}
        <Reveal delay={120}>
          <Text style={styles.homeSectionTitle}>Check something</Text>
          <View style={[styles.homeGrid, { marginTop: theme.space.md }]}>
            {homeQuickChecks.map((tool) => (
              <HomeTile key={tool.screen} {...tool} onPress={() => navigate(tool.screen)} />
            ))}
          </View>
        </Reveal>

        {/* Today's lesson */}
        {nextLesson ? (
          <Reveal delay={180}>
            <Text style={[styles.homeSectionTitle, { marginBottom: theme.space.md }]}>Today’s lesson</Text>
            <TouchableOpacity
              style={styles.lessonCta}
              activeOpacity={0.9}
              disabled={!nextUnlocked}
              onPress={() => openLesson(nextLesson.id)}
              accessibilityRole="button"
            >
              <View style={styles.lessonCtaIcon}>
                <GraduationCap size={theme.icon(30)} color={theme.colors.onBrand} strokeWidth={2.3} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lessonCtaEyebrow}>Week {nextLesson.week} · {nextLesson.minutes} min</Text>
                <Text style={styles.lessonCtaTitle}>{nextLesson.title}</Text>
              </View>
              <ChevronRight size={theme.icon(26)} color={theme.colors.onBrand} strokeWidth={2.5} />
            </TouchableOpacity>
          </Reveal>
        ) : null}

        {/* Trusted contact */}
        <Reveal delay={240}>
          <TrustedContactStrip contacts={contacts} onCall={callContact} onText={textContact} onManage={() => navigate('contacts')} />
        </Reveal>
      </View>
    );
  }

  function renderTools() {
    return (
      <View style={styles.checksStack}>
        <Text style={styles.screenIntro}>What would you like to check?</Text>
        {toolGroups.map((group) => {
          const GroupIcon = group.icon;
          return (
            <View key={group.title} style={styles.checkGroup}>
              <View style={styles.checkGroupHeader}>
                <View style={styles.checkGroupIcon}>
                  <GroupIcon size={theme.icon(22)} color={theme.colors.brand} strokeWidth={2.4} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.checkGroupTitle}>{group.title}</Text>
                  <Text style={styles.checkGroupSubtitle}>{group.subtitle}</Text>
                </View>
              </View>
              <View style={styles.checkGroupBody}>
                {group.items.map((tool, index) => (
                  <ToolRow key={tool.screen} {...tool} last={index === group.items.length - 1} onPress={() => navigate(tool.screen)} />
                ))}
              </View>
            </View>
          );
        })}
      </View>
    );
  }


  function renderScamCheck() {
    const aiReady = isAiReviewConfigured();
    const hfReady = isHfSpamCheckConfigured();
    const ocrReady = isHfOcrConfigured();
    const transcriptionReady = isHfTranscriptionConfigured();
    const showLocalResult = messageChecked && hasScamInput;

    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>Paste the words below. You can also add a screenshot or a voicemail note.</Text>
        <TextInput
          style={styles.textArea}
          value={messageText}
          onChangeText={updateMessageText}
          multiline
          textAlignVertical="top"
          placeholder="Paste the message or email here"
          placeholderTextColor={theme.colors.faint}
          accessibilityLabel="Message text"
        />
        <View style={styles.buttonRow}>
          <SecondaryAction icon={Upload} label="Screenshot" onPress={pickScreenshot} />
          <SecondaryAction icon={FileAudio} label="Audio" onPress={pickVoicemail} />
          <SecondaryAction icon={X} label="Clear" onPress={clearMessageCheck} disabled={!messageText && !voicemailTranscript && !screenshotUri && !voicemailFile} />
        </View>

        {screenshotUri ? (
          <View style={styles.attachment}>
            <Image source={{ uri: screenshotUri }} style={styles.attachmentImage as ImageStyle} />
            <View style={{ flex: 1 }}>
              <Text style={styles.attachmentTitle}>Screenshot attached</Text>
              <Text style={styles.smallMuted}>{screenshotBase64 ? 'Ready to read or review.' : 'Saved here.'}</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setScreenshotUri('');
                setScreenshotBase64('');
                setAiReview(null);
                setAiReviewError('');
                setOcrText('');
                setOcrError('');
              }}
              accessibilityLabel="Remove screenshot"
            >
              <X size={theme.icon(22)} color={theme.colors.muted} />
            </TouchableOpacity>
          </View>
        ) : null}

        {voicemailFile ? (
          <AttachmentLabel
            icon={FileAudio}
            label={voicemailFile}
            onClear={() => {
              setVoicemailFile('');
              setVoicemailUri('');
              setVoicemailMimeType('');
              setTranscriptionError('');
            }}
          />
        ) : null}

        <TextInput
          style={styles.textAreaSmall}
          value={voicemailTranscript}
          onChangeText={updateVoicemailTranscript}
          multiline
          textAlignVertical="top"
          placeholder="Optional: notes or a voicemail transcript"
          placeholderTextColor={theme.colors.faint}
          accessibilityLabel="Optional transcript"
        />

        <Btn label="Check this message" icon={ShieldCheck} onPress={runMessageCheck} disabled={!hasMessageReviewInput} />

        {screenshotBase64 ? (
          <View style={styles.aiActionBox}>
            <View style={styles.buttonRow}>
              <SecondaryAction icon={Search} label={ocrLoading ? 'Reading…' : 'Read screenshot'} onPress={runScreenshotOcr} disabled={ocrLoading || !ocrReady} />
              {aiReady ? <SecondaryAction icon={ShieldCheck} label={aiReviewLoading ? 'Reviewing…' : 'AI review'} onPress={runAiReview} disabled={aiReviewLoading} /> : null}
            </View>
            {!ocrReady ? <Text style={styles.smallMuted}>Screenshot reading needs a Hugging Face key.</Text> : null}
            {ocrError ? <Text style={styles.errorText}>{ocrError}</Text> : null}
            {aiReviewError ? <Text style={styles.errorText}>{aiReviewError}</Text> : null}
          </View>
        ) : null}
        {ocrText ? <ExtractedTextPanel title="Text from screenshot" text={ocrText} /> : null}

        {voicemailUri ? (
          <View style={styles.aiActionBox}>
            <SecondaryAction icon={Mic} label={transcriptionLoading ? 'Transcribing…' : 'Transcribe audio'} onPress={runAudioTranscription} disabled={transcriptionLoading || !transcriptionReady} />
            {!transcriptionReady ? <Text style={styles.smallMuted}>Audio transcription needs a Hugging Face key.</Text> : null}
            {transcriptionError ? <Text style={styles.errorText}>{transcriptionError}</Text> : null}
          </View>
        ) : null}

        {hfSpamLoading ? <Text style={styles.smallMuted}>Running an extra check…</Text> : null}
        {hfSpamNotice ? <Text style={styles.smallMuted}>{hfSpamNotice}</Text> : null}
        {hfSpamError ? <Text style={styles.errorText}>{hfSpamError}</Text> : null}
        {hfSpamReview ? <SpamModelPanel review={hfSpamReview} /> : null}
        {aiReview ? <AiReviewPanel review={aiReview} /> : null}
        {showLocalResult ? <RiskPanel result={scamResult} /> : null}
        {!hfReady && showLocalResult ? <Text style={styles.smallMuted}>Tip: add a Hugging Face key in the project to enable a second AI opinion.</Text> : null}
      </View>
    );
  }

  function renderCallCheck() {
    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>Answer yes or no about the call.</Text>
        <ToggleRow label="Asked for money?" value={callAnswers.money} onValueChange={(v) => setCallAnswers({ ...callAnswers, money: v })} />
        <ToggleRow label="Said not to tell anyone?" value={callAnswers.secret} onValueChange={(v) => setCallAnswers({ ...callAnswers, secret: v })} />
        <ToggleRow label="Asked for a code?" value={callAnswers.code} onValueChange={(v) => setCallAnswers({ ...callAnswers, code: v })} />
        <ToggleRow label="Asked to control your device?" value={callAnswers.remote} onValueChange={(v) => setCallAnswers({ ...callAnswers, remote: v })} />
        <ToggleRow label="Threatened arrest or account closing?" value={callAnswers.threat} onValueChange={(v) => setCallAnswers({ ...callAnswers, threat: v })} />
        <ToggleRow label="Trusting caller ID only?" value={callAnswers.callerId} onValueChange={(v) => setCallAnswers({ ...callAnswers, callerId: v })} />
        <SecondaryAction icon={X} label="Clear answers" onPress={() => setCallAnswers(initialCallAnswers)} disabled={!hasCallAnswers} />
        {hasCallAnswers ? <RiskPanel result={callResult} /> : null}
        <TrustedContactStrip contacts={contacts} onCall={callContact} onText={textContact} />
      </View>
    );
  }

  function renderEmergency() {
    const dontDo: Array<{ icon: LucideIcon; text: string }> = [
      { icon: PhoneOff, text: 'Hang up now. You do not have to stay on the call.' },
      { icon: Ban, text: 'Do not send money, gift cards, or crypto.' },
      { icon: LinkIcon, text: 'Do not click any links they sent you.' },
      { icon: KeyRound, text: 'Do not share codes, passwords, or bank details.' },
      { icon: MonitorOff, text: 'Do not install anything or allow remote access.' },
    ];
    return (
      <View style={styles.stack}>
        <View style={styles.emergencyHero}>
          <View style={styles.emergencyHeroIcon}>
            <Siren size={theme.icon(42)} color={theme.colors.onBrand} strokeWidth={2} />
          </View>
          <Text style={styles.emergencyHeroTitle}>Stop. You have time.</Text>
          <Text style={styles.emergencyHeroText}>A real bank, agency, or family member can always wait. Take a slow breath.</Text>
        </View>

        <Text style={styles.emergencySectionTitle}>Right now, do NOT</Text>
        <View style={styles.dontList}>
          {dontDo.map((item, index) => {
            const Icon = item.icon;
            return (
              <View key={item.text} style={[styles.dontRow, index < dontDo.length - 1 && styles.dontRowDivider]}>
                <View style={styles.dontIcon}>
                  <Icon size={theme.icon(24)} color={theme.colors.danger} strokeWidth={2} />
                </View>
                <Text style={styles.dontText}>{item.text}</Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.emergencySectionTitle}>Then get help</Text>
        <TrustedContactStrip contacts={contacts} onCall={callContact} onText={textContact} urgent />
        <View style={styles.emergencyInfo}>
          <Phone size={theme.icon(22)} color={theme.colors.brand} strokeWidth={2} />
          <Text style={styles.emergencyInfoText}>
            Call the official number printed on your card or statement — never a number the caller gave you.
          </Text>
        </View>
        <Btn label="Report fraud to the FTC" icon={ExternalLink} onPress={() => Linking.openURL('https://reportfraud.ftc.gov/')} />
      </View>
    );
  }

  function renderContacts() {
    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>Save up to two people you trust, so help is always one tap away.</Text>
        {contactDrafts.map((contact, index) => (
          <Card key={contact.id}>
            <Text style={styles.cardTitle}>{contact.label}</Text>
            <TextInput
              style={styles.input}
              value={contact.name}
              onChangeText={(value) => setContactDrafts((current) => current.map((item, i) => (i === index ? { ...item, name: value } : item)))}
              placeholder={index === 0 ? 'Daughter, son, caregiver, friend' : 'Backup contact'}
              placeholderTextColor={theme.colors.faint}
            />
            <TextInput
              style={styles.input}
              value={contact.phone}
              onChangeText={(value) => setContactDrafts((current) => current.map((item, i) => (i === index ? { ...item, phone: value } : item)))}
              keyboardType="phone-pad"
              placeholder="Phone number"
              placeholderTextColor={theme.colors.faint}
            />
            <View style={styles.buttonRow}>
              <SecondaryAction icon={CheckCircle2} label="Save" onPress={() => saveContactDraft(index)} />
              <SecondaryAction icon={Phone} label="Call" onPress={() => callContact(contact)} disabled={!contact.phone.trim()} />
              <SecondaryAction icon={MessageCircle} label="Text" onPress={() => textContact(contact)} disabled={!contact.phone.trim()} />
            </View>
          </Card>
        ))}
        <Card>
          <Text style={styles.cardTitle}>Family verification phrase</Text>
          <Text style={styles.cardBody}>Agree on a private phrase with your family. Ask for it during any emergency call to confirm it is really them.</Text>
          <TextInput style={styles.input} value={familyPhrase} onChangeText={setFamilyPhrase} placeholder="Example: blue porch light" placeholderTextColor={theme.colors.faint} />
          <Btn label="Save phrase" icon={ShieldCheck} onPress={savePhrase} />
        </Card>
      </View>
    );
  }


  function renderLinkCheck() {
    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>Paste a link before opening it. We check the real destination.</Text>
        <TextInput
          style={styles.input}
          value={urlText}
          onChangeText={setUrlText}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://example.com"
          placeholderTextColor={theme.colors.faint}
        />
        {hasUrlInput ? <RiskPanel result={linkResult} /> : null}
        <SecondaryAction icon={X} label="Clear" onPress={() => setUrlText('')} disabled={!hasUrlInput} />
        <TouchableOpacity style={[styles.secondaryButtonWide, !hasUrlInput && styles.disabledButton]} onPress={() => openUrl(urlText)} disabled={!hasUrlInput}>
          <ExternalLink size={theme.icon(20)} color={hasUrlInput ? theme.colors.brand : theme.colors.faint} />
          <Text style={[styles.secondaryButtonWideText, !hasUrlInput && styles.disabledText]}>Open only if you expected it</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderQrCheck() {
    const canScan = cameraPermission?.granted;
    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>Scan first, then open only after checking.</Text>
        {!canScan ? (
          <Btn label="Allow camera for QR scan" icon={Camera} onPress={requestCameraPermission} />
        ) : null}
        {canScan && scanning ? (
          <View style={styles.cameraFrame}>
            <CameraView style={styles.cameraView} facing="back" onBarcodeScanned={onQrScanned} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} />
            <Text style={styles.cameraHint}>Point at a QR code</Text>
          </View>
        ) : (
          <Btn label={qrValue ? 'Scan another QR code' : 'Start QR scan'} icon={QrCode} onPress={() => setScanning(true)} disabled={!canScan} />
        )}
        <TextInput
          style={styles.input}
          value={qrValue}
          onChangeText={setQrValue}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="QR destination appears here"
          placeholderTextColor={theme.colors.faint}
        />
        {hasQrInput ? <RiskPanel result={qrResult} /> : null}
        <SecondaryAction icon={X} label="Clear" onPress={() => setQrValue('')} disabled={!hasQrInput} />
        <TouchableOpacity style={[styles.secondaryButtonWide, !hasQrInput && styles.disabledButton]} onPress={() => openUrl(qrValue)} disabled={!hasQrInput}>
          <ExternalLink size={theme.icon(20)} color={hasQrInput ? theme.colors.brand : theme.colors.faint} />
          <Text style={[styles.secondaryButtonWideText, !hasQrInput && styles.disabledText]}>Open only if verified</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderVoiceClone() {
    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>Use this when a caller sounds like family but something feels off.</Text>
        <ToggleRow label="Says they are family?" value={voiceAnswers.family} onValueChange={(v) => setVoiceAnswers({ ...voiceAnswers, family: v })} />
        <ToggleRow label="Needs money now?" value={voiceAnswers.money} onValueChange={(v) => setVoiceAnswers({ ...voiceAnswers, money: v })} />
        <ToggleRow label="Says keep it secret?" value={voiceAnswers.secret} onValueChange={(v) => setVoiceAnswers({ ...voiceAnswers, secret: v })} />
        <ToggleRow label="Story feels shocking?" value={voiceAnswers.emotional} onValueChange={(v) => setVoiceAnswers({ ...voiceAnswers, emotional: v })} />
        <Card>
          <Text style={styles.cardTitle}>Verification phrase</Text>
          <TextInput style={styles.input} value={familyPhrase} onChangeText={setFamilyPhrase} placeholder="Private family phrase" placeholderTextColor={theme.colors.faint} />
          <SecondaryAction icon={ShieldCheck} label="Save phrase" onPress={savePhrase} />
        </Card>
        <SecondaryAction icon={X} label="Clear answers" onPress={() => setVoiceAnswers(initialVoiceAnswers)} disabled={!hasVoiceAnswers} />
        {hasVoiceAnswers ? <RiskPanel result={voiceResult} /> : null}
      </View>
    );
  }

  function renderPaymentSafety() {
    const labels: Record<string, string> = {
      giftCard: 'Gift card',
      crypto: 'Crypto',
      wire: 'Wire transfer',
      zelle: 'Zelle',
      cashApp: 'Cash App',
      venmo: 'Venmo',
      bankCard: 'Card or bank payment',
    };
    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>Choose the payment they asked for.</Text>
        {Object.entries(labels).map(([key, label]) => (
          <ToggleRow key={key} label={label} value={paymentAnswers[key]} onValueChange={(v) => setPaymentAnswers({ ...paymentAnswers, [key]: v })} />
        ))}
        <SecondaryAction icon={X} label="Clear answers" onPress={() => setPaymentAnswers(initialPayments)} disabled={!hasPaymentAnswers} />
        {hasPaymentAnswers ? <RiskPanel result={paymentResult} /> : null}
      </View>
    );
  }

  function renderNews() {
    return (
      <View style={styles.stack}>
        <View style={styles.sectionHeader}>
          <Text style={styles.screenIntroNarrow}>Current warnings from public safety sources.</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={refreshAlerts} accessibilityRole="button">
            <Newspaper size={theme.icon(18)} color={theme.colors.brand} />
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>
        {alerts.map((alert) => (
          <TouchableOpacity key={alert.id} style={styles.newsItem} onPress={() => Linking.openURL(alert.url)} activeOpacity={0.75}>
            <View style={styles.newsTop}>
              <Text style={styles.newsSource}>{alert.source}</Text>
              <Text style={styles.newsDate}>{formatDate(alert.date)}</Text>
            </View>
            <Text style={styles.newsTitle}>{alert.title}</Text>
            <Text style={styles.cardBody}>{alert.summary}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }


  function renderLearn() {
    const modules = weeklyModules;
    const createdAt = profile?.createdAt ?? new Date().toISOString();
    const done = progress.completedWeeks.filter((id) => modules.some((m) => m.id === id)).length;
    const pct = modules.length ? Math.round((done / modules.length) * 100) : 0;
    return (
      <View style={styles.learnStack}>
        <View style={styles.confidencePanel}>
          <View style={styles.metricTopRow}>
            <Text style={styles.metricLabel}>Your learning journey</Text>
            <Text style={styles.metricSmall}>
              {done} of {modules.length} done
            </Text>
          </View>
          <Text style={styles.metricValue}>{pct}%</Text>
          <ProgressBar value={pct === 0 ? 2 : pct} />
        </View>
        <Text style={styles.screenIntro}>A new lesson opens each week. Tap one to read it and take the quiz.</Text>
        {modules.map((module) => (
          <WeekRow
            key={module.id}
            module={module}
            createdAt={createdAt}
            completed={progress.completedWeeks.includes(module.id)}
            onOpen={() => openLesson(module.id)}
          />
        ))}
        <Btn label="Extra practice quiz" icon={Trophy} variant="secondary" onPress={() => navigate('practice')} />
      </View>
    );
  }

  function renderLesson() {
    const module = weeklyModules.find((m) => m.id === activeModuleId);
    if (!module) return renderLearn();
    return <LessonScreen module={module} onBack={() => navigate('learn')} />;
  }

  function renderPractice() {
    const options: Array<'safe' | 'suspicious' | 'scam'> = ['safe', 'suspicious', 'scam'];
    const answered = selectedPractice !== null;
    return (
      <View style={styles.stack}>
        <View style={styles.confidencePanel}>
          <View style={styles.metricTopRow}>
            <Text style={styles.metricLabel}>
              Question {practiceNumber} of {practiceExamples.length}
            </Text>
            <Text style={styles.metricSmall}>{practiceStats.answered ? `${practiceStats.correct}/${practiceStats.answered} correct` : 'Start quiz'}</Text>
          </View>
          <Text style={styles.metricValue}>{quizScore}%</Text>
          <ProgressBar value={quizScore} />
        </View>
        <View style={styles.practiceCard}>
          <Text style={styles.newsSource}>{practice.channel}</Text>
          <Text style={styles.practiceText}>{practice.message}</Text>
        </View>
        <View style={styles.optionGrid}>
          {options.map((option) => {
            const isSelected = selectedPractice === option;
            const isCorrect = answered && practice.answer === option;
            const isWrong = answered && isSelected && practice.answer !== option;
            return (
              <TouchableOpacity
                key={option}
                style={[styles.answerButton, isSelected && styles.answerSelected, isCorrect && styles.answerCorrect, isWrong && styles.answerWrong]}
                onPress={() => choosePractice(option)}
                activeOpacity={0.78}
                disabled={answered}
              >
                {isCorrect ? (
                  <CheckCircle2 size={theme.icon(22)} color={theme.colors.low} />
                ) : isWrong ? (
                  <X size={theme.icon(22)} color={theme.colors.danger} />
                ) : (
                  <Circle size={theme.icon(22)} color={isSelected ? theme.colors.info : theme.colors.muted} />
                )}
                <Text style={styles.answerText}>{option === 'safe' ? 'Safe' : option === 'suspicious' ? 'Not sure' : 'Scam'}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {answered ? (
          <View style={styles.feedbackPanel}>
            <Text style={[styles.feedbackTitle, selectedPractice !== practice.answer && styles.feedbackWrong]}>
              {selectedPractice === practice.answer ? 'Correct' : `Answer: ${practice.answer === 'suspicious' ? 'not sure' : practice.answer}`}
            </Text>
            <Text style={styles.cardBody}>{practice.explanation}</Text>
            {practice.redFlags.map((flag) => (
              <View key={flag} style={styles.bulletRow}>
                <AlertTriangle size={theme.icon(18)} color={theme.colors.high} />
                <Text style={styles.bulletText}>{flag}</Text>
              </View>
            ))}
            <Btn label="Next example" icon={ChevronRight} onPress={nextPractice} />
            <SecondaryAction icon={X} label="Restart quiz" onPress={restartPractice} />
          </View>
        ) : null}
      </View>
    );
  }

  function renderRecovery() {
    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>If anything was shared or paid, act quickly. Start here.</Text>
        {recoverySteps.map((group) => (
          <Card key={group.title}>
            <Text style={styles.cardTitle}>{group.title}</Text>
            {group.items.map((item) => (
              <View key={item} style={styles.bulletRow}>
                <CheckCircle2 size={theme.icon(19)} color={theme.colors.brand} />
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </Card>
        ))}
        <Btn label="Report fraud to the FTC" icon={ExternalLink} onPress={() => Linking.openURL('https://reportfraud.ftc.gov/')} />
        <Btn label="Report internet fraud to IC3" icon={ExternalLink} variant="secondary" onPress={() => Linking.openURL('https://www.ic3.gov/')} />
      </View>
    );
  }

  function renderPhoneLookup() {
    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>Check an unknown or incoming number for spoofing and scam signs. This runs entirely on your device.</Text>
        <TextInput
          style={styles.input}
          value={phoneNumber}
          onChangeText={(v) => {
            setPhoneNumber(v);
            setCallRisk(null);
          }}
          keyboardType="phone-pad"
          placeholder="Phone number (for example +1 202 555 0140)"
          placeholderTextColor={theme.colors.faint}
        />
        <TextInput
          style={styles.input}
          value={claimedIdentity}
          onChangeText={setClaimedIdentity}
          placeholder="Who do they claim to be? (optional)"
          placeholderTextColor={theme.colors.faint}
        />
        <Btn label="Check this number" icon={ShieldCheck} onPress={runCallRiskCheck} disabled={!hasPhoneInput} />
        {callRisk ? <CallRiskPanel result={callRisk} /> : null}
        <TouchableOpacity style={[styles.secondaryButtonWide, !hasPhoneInput && styles.disabledButton]} onPress={openSearchForPhone} disabled={!hasPhoneInput}>
          <Search size={theme.icon(20)} color={hasPhoneInput ? theme.colors.brand : theme.colors.faint} />
          <Text style={[styles.secondaryButtonWideText, !hasPhoneInput && styles.disabledText]}>Search community scam reports</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderVoicemail() {
    const voicemailResult = analyzeMessage(voicemailTranscript, 'voicemail transcript');
    const transcriptionReady = isHfTranscriptionConfigured();
    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>Upload a voicemail to transcribe it, or paste the transcript yourself.</Text>
        <Btn label="Upload voicemail" icon={FileAudio} onPress={pickVoicemail} />
        {voicemailFile ? (
          <AttachmentLabel
            icon={FileAudio}
            label={voicemailFile}
            onClear={() => {
              setVoicemailFile('');
              setVoicemailUri('');
              setVoicemailMimeType('');
              setTranscriptionError('');
            }}
          />
        ) : null}
        {voicemailUri ? (
          <View style={styles.aiActionBox}>
            <SecondaryAction icon={Mic} label={transcriptionLoading ? 'Transcribing…' : 'Transcribe file'} onPress={runAudioTranscription} disabled={transcriptionLoading || !transcriptionReady} />
            {!transcriptionReady ? <Text style={styles.smallMuted}>Audio transcription needs a Hugging Face key.</Text> : null}
            {transcriptionError ? <Text style={styles.errorText}>{transcriptionError}</Text> : null}
          </View>
        ) : null}
        <TextInput
          style={styles.textArea}
          value={voicemailTranscript}
          onChangeText={updateVoicemailTranscript}
          multiline
          textAlignVertical="top"
          placeholder="Paste voicemail transcript here"
          placeholderTextColor={theme.colors.faint}
        />
        <SecondaryAction
          icon={X}
          label="Clear"
          onPress={() => {
            setVoicemailTranscript('');
            setVoicemailFile('');
            setVoicemailUri('');
            setVoicemailMimeType('');
            setTranscriptionError('');
          }}
          disabled={!voicemailTranscript && !voicemailFile}
        />
        {hasVoicemailInput ? <RiskPanel result={voicemailResult} /> : null}
      </View>
    );
  }

  function renderActivity() {
    if (!detections.length) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Bell size={theme.icon(34)} color={theme.colors.brand} strokeWidth={2.2} />
          </View>
          <Text style={styles.cardTitle}>No notifications yet</Text>
          <Text style={[styles.cardBody, { textAlign: 'center' }]}>When a check finds a possible scam call, message, or link, a notification appears here and on your phone.</Text>
        </View>
      );
    }
    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>Every check that found a possible risk is saved here on your device.</Text>
        {detections.map((event) => (
          <ActivityRow key={event.id} event={event} detailed />
        ))}
      </View>
    );
  }

  function renderGames() {
    const back = () => setGame('none');
    if (game === 'scramble') return <ScrambleGame onBack={back} onWin={recordStreak} />;
    if (game === 'match') return <MatchGame onBack={back} onWin={recordStreak} />;
    if (game === 'crossword') return <CrosswordGame onBack={back} onWin={recordStreak} />;
    if (game === 'truefalse') return <TrueFalseGame onBack={back} onWin={recordStreak} />;
    if (game === 'fillblank') return <FillBlankGame onBack={back} onWin={recordStreak} />;
    if (game === 'redflag') return <RedFlagGame onBack={back} onWin={recordStreak} />;
    if (game === 'memory') return <MemoryGame onBack={back} onWin={recordStreak} />;

    const tiles: Array<{ icon: LucideIcon; title: string; onPress: () => void; tone: number }> = [
      { icon: Trophy, title: 'Spot the Scam', onPress: () => navigate('practice'), tone: 0 },
      { icon: Grid3x3, title: 'Crossword', onPress: () => setGame('crossword'), tone: 1 },
      { icon: Shuffle, title: 'Word Scramble', onPress: () => setGame('scramble'), tone: 2 },
      { icon: Puzzle, title: 'Match the Term', onPress: () => setGame('match'), tone: 3 },
      { icon: ToggleLeft, title: 'True or False', onPress: () => setGame('truefalse'), tone: 0 },
      { icon: PenLine, title: 'Fill the Blank', onPress: () => setGame('fillblank'), tone: 1 },
      { icon: Flag, title: 'Red Flag Rush', onPress: () => setGame('redflag'), tone: 2 },
      { icon: Brain, title: 'Memory Match', onPress: () => setGame('memory'), tone: 3 },
    ];
    return (
      <View style={styles.stack}>
        <StreakBanner streak={progress.streak} best={progress.bestStreak} />
        <Text style={styles.screenIntro}>Play a quick game to keep sharp. Play any week to grow your streak — no timer, no pressure.</Text>
        <View style={styles.tileGrid}>
          {tiles.map((tile, i) => (
            <Reveal key={tile.title} delay={i * 55} style={styles.gameTileWrap}>
              <GameTile icon={tile.icon} title={tile.title} tone={tile.tone} onPress={tile.onPress} />
            </Reveal>
          ))}
        </View>
      </View>
    );
  }

  function renderScreen() {
    switch (screen) {
      case 'tools':
        return renderTools();
      case 'scam':
        return renderScamCheck();
      case 'call':
        return renderCallCheck();
      case 'emergency':
        return renderEmergency();
      case 'contacts':
        return renderContacts();
      case 'link':
        return renderLinkCheck();
      case 'qr':
        return renderQrCheck();
      case 'voice':
        return renderVoiceClone();
      case 'payment':
        return renderPaymentSafety();
      case 'news':
        return renderNews();
      case 'learn':
        return renderLearn();
      case 'lesson':
        return renderLesson();
      case 'practice':
        return renderPractice();
      case 'recovery':
        return renderRecovery();
      case 'phone':
        return renderPhoneLookup();
      case 'voicemail':
        return renderVoicemail();
      case 'games':
        return renderGames();
      case 'settings':
        return <Settings />;
      default:
        return renderHome();
    }
  }

  return (
    <KeyboardAvoidingView style={styles.app} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      {renderHeader()}
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Animated.View
          style={[
            styles.screenTransition,
            {
              opacity: screenAnim,
              transform: [{ translateY: screenAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
            },
          ]}
        >
          {renderScreen()}
        </Animated.View>
      </ScrollView>
      {renderBottomNav()}
      <Modal visible={emergencyVisible && screen === 'emergency'} animationType="slide" onRequestClose={() => setEmergencyVisible(false)}>
        <View style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Scam Safety Steps</Text>
            <Pressable style={styles.closeButton} onPress={() => setEmergencyVisible(false)} accessibilityLabel="Close">
              <X size={theme.icon(24)} color={theme.colors.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>{renderEmergency()}</ScrollView>
        </View>
      </Modal>
      <Modal visible={!walkthroughSeen} animationType="fade" onRequestClose={markWalkthroughSeen}>
        <Walkthrough
          onSkip={markWalkthroughSeen}
          onLesson={startWalkthroughLesson}
          onQuickCheck={() => {
            markWalkthroughSeen();
            navigate('scam');
          }}
        />
      </Modal>

      {/* Notifications (opened by the bell on every page) */}
      <Modal visible={notificationsVisible} animationType="slide" onRequestClose={() => setNotificationsVisible(false)}>
        <View style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Notifications</Text>
            <Pressable style={styles.closeButton} onPress={() => setNotificationsVisible(false)} accessibilityLabel="Close">
              <X size={theme.icon(24)} color={theme.colors.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>{renderActivity()}</ScrollView>
        </View>
      </Modal>

      {/* Menu / options (hamburger on home) — slides in from the side */}
      <SideDrawer visible={menuVisible} onClose={() => setMenuVisible(false)}>
        <View style={styles.drawerHeader}>
          <View style={styles.drawerLogo}>
            <ShieldCheck size={theme.icon(24)} color={theme.colors.onBrand} strokeWidth={2} />
          </View>
          <Text style={styles.drawerTitle}>Menu</Text>
          <Pressable style={styles.closeButton} onPress={() => setMenuVisible(false)} accessibilityLabel="Close menu">
            <X size={theme.icon(22)} color={theme.colors.ink} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.xs }}>
          <ListRow icon={SettingsIcon} label="Settings" onPress={() => { setMenuVisible(false); navigate('settings'); }} />
          <ListRow icon={Bell} label="Notifications" onPress={() => { setMenuVisible(false); setNotificationsVisible(true); markAllDetectionsRead(); }} />
          <ListRow icon={Users} label="Trusted contacts" onPress={() => { setMenuVisible(false); navigate('contacts'); }} />
          <ListRow icon={Puzzle} label="Games" onPress={() => { setMenuVisible(false); navigate('games'); }} />
          <ListRow icon={KeyRound} label="App permissions" onPress={() => requestAllPermissions()} />
          <ListRow icon={Info} label="About Shield Our Elders" onPress={() => { setMenuVisible(false); setAboutVisible(true); }} last />
        </ScrollView>
      </SideDrawer>

      {/* About Us */}
      <Modal visible={aboutVisible} animationType="slide" onRequestClose={() => setAboutVisible(false)}>
        <View style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>About Us</Text>
            <Pressable style={styles.closeButton} onPress={() => setAboutVisible(false)} accessibilityLabel="Close">
              <X size={theme.icon(24)} color={theme.colors.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.aboutHeroWrap}>
              <View style={styles.aboutLogo}>
                <ShieldCheck size={theme.icon(46)} color={theme.colors.onBrand} strokeWidth={2} />
              </View>
              <Text style={styles.aboutTitle}>Shield Our Elders</Text>
              <Text style={styles.aboutTagline}>Senior-friendly scam defense</Text>
            </View>
            <Text style={styles.cardBody}>
              Scams work by creating pressure. Our mission is simple: help older adults slow down, check whether a call, message, link, or payment is safe, and take a calm next step — without needing to be a technology expert.
            </Text>
            <Text style={styles.cardBody}>
              Everything stays private on your device. We built this for seniors living independently and for the families and caregivers who help protect the people they love.
            </Text>
            <Card>
              <Text style={styles.cardTitle}>What we believe</Text>
              <View style={styles.bulletRow}><CheckCircle2 size={theme.icon(19)} color={theme.colors.brand} /><Text style={styles.bulletText}>You always have time to check.</Text></View>
              <View style={styles.bulletRow}><CheckCircle2 size={theme.icon(19)} color={theme.colors.brand} /><Text style={styles.bulletText}>Clear, plain language beats jargon.</Text></View>
              <View style={styles.bulletRow}><CheckCircle2 size={theme.icon(19)} color={theme.colors.brand} /><Text style={styles.bulletText}>Your privacy is part of your safety.</Text></View>
            </Card>
            <Text style={styles.smallMuted}>
              Shield Our Elders offers scam-safety guidance only. It does not replace your bank, the police, lawyers, or emergency services. For immediate danger, call your local emergency number.
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}


// ---------------------------------------------------------------------------
// Presentational components (theme-aware)
// ---------------------------------------------------------------------------

function HomeTile({ label, detail, icon: Icon, onPress, tone }: { label: string; detail: string; icon: LucideIcon; onPress: () => void; tone?: RiskLevel }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const scale = useRef(new Animated.Value(1)).current;
  const color = tone ? levelColor(theme, tone) : theme.colors.brand;
  const press = (to: number) => {
    if (theme.reducedMotion) return;
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 5 }).start();
  };
  return (
    <Animated.View style={[styles.homeTileWrap, { transform: [{ scale }] }]}>
      <Pressable style={styles.homeTile} onPress={onPress} onPressIn={() => press(0.96)} onPressOut={() => press(1)} accessibilityRole="button" accessibilityLabel={`${label}. ${detail}`}>
        <View style={[styles.homeTileIcon, { backgroundColor: tone ? levelBg(theme, tone) : theme.colors.brandTint }]}>
          <Icon size={theme.icon(32)} color={color} strokeWidth={2.3} />
        </View>
        <Text style={styles.homeTileTitle}>{label}</Text>
        <Text style={styles.homeTileDetail}>{detail}</Text>
      </Pressable>
    </Animated.View>
  );
}

function ToolRow({ label, detail, icon: Icon, onPress, tone, last }: { label: string; detail: string; icon: LucideIcon; onPress: () => void; tone?: RiskLevel; last?: boolean }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const color = tone ? levelColor(theme, tone) : theme.colors.brand;
  return (
    <TouchableOpacity
      style={[styles.toolRow, !last && styles.toolRowDivider]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${detail}`}
    >
      <View style={[styles.toolRowIcon, { backgroundColor: tone ? levelBg(theme, tone) : theme.colors.brandTint }]}>
        <Icon size={theme.icon(26)} color={color} strokeWidth={2.4} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.toolRowTitle}>{label}</Text>
        <Text style={styles.toolRowDetail}>{detail}</Text>
      </View>
      <ChevronRight size={theme.icon(24)} color={theme.colors.faint} strokeWidth={2.4} />
    </TouchableOpacity>
  );
}

function ExtractedTextPanel({ title, text }: { title: string; text: string }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.scriptBox}>
      <Text style={styles.scriptLabel}>{title}</Text>
      <Text style={styles.scriptText}>{text}</Text>
    </View>
  );
}

function SpamModelPanel({ review }: { review: HfSpamReview }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const color = levelColor(theme, review.level);
  return (
    <View style={[styles.riskPanel, { backgroundColor: levelBg(theme, review.level), borderColor: color }]}>
      <View style={styles.riskTop}>
        <View style={styles.riskTextColumn}>
          <Text style={[styles.riskLabel, { color }]}>SMS spam check</Text>
          <Text style={styles.riskHeadline}>{review.headline}</Text>
        </View>
        <View style={[styles.scoreBadge, { borderColor: color }]}>
          <Text style={[styles.scoreText, { color }]}>{review.score}</Text>
        </View>
      </View>
      <Text style={styles.cardBody}>{review.summary}</Text>
      <Text style={styles.nextTitle}>Why it was flagged</Text>
      {review.reasons.map((reason) => (
        <View key={reason} style={styles.bulletRow}>
          <AlertTriangle size={theme.icon(18)} color={color} />
          <Text style={styles.bulletText}>{reason}</Text>
        </View>
      ))}
      <Text style={styles.nextTitle}>Do next</Text>
      {review.nextSteps.map((step) => (
        <View key={step} style={styles.bulletRow}>
          <CheckCircle2 size={theme.icon(19)} color={theme.colors.brand} />
          <Text style={styles.bulletText}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

function AiReviewPanel({ review }: { review: AiScamReview }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const color = levelColor(theme, review.level);
  return (
    <View style={[styles.riskPanel, { backgroundColor: levelBg(theme, review.level), borderColor: color }]}>
      <View style={styles.riskTop}>
        <View style={styles.riskTextColumn}>
          <Text style={[styles.riskLabel, { color }]}>AI review</Text>
          <Text style={styles.riskHeadline}>{review.headline}</Text>
        </View>
        <View style={[styles.scoreBadge, { borderColor: color }]}>
          <Text style={[styles.scoreText, { color }]}>{review.score}</Text>
        </View>
      </View>
      <Text style={styles.cardBody}>{review.summary}</Text>
      {review.screenshotText ? (
        <View style={styles.scriptBox}>
          <Text style={styles.scriptLabel}>Read from screenshot</Text>
          <Text style={styles.scriptText}>{review.screenshotText}</Text>
        </View>
      ) : null}
      <Text style={styles.nextTitle}>Why it was flagged</Text>
      {review.reasons.map((reason) => (
        <View key={reason} style={styles.bulletRow}>
          <AlertTriangle size={theme.icon(18)} color={color} />
          <Text style={styles.bulletText}>{reason}</Text>
        </View>
      ))}
      <Text style={styles.nextTitle}>Do next</Text>
      {review.nextSteps.map((step) => (
        <View key={step} style={styles.bulletRow}>
          <CheckCircle2 size={theme.icon(19)} color={theme.colors.brand} />
          <Text style={styles.bulletText}>{step}</Text>
        </View>
      ))}
    </View>
  );
}


function RiskPanel({ result }: { result: AnalysisResult }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const color = levelColor(theme, result.level);
  const visibleFindings = [...result.findings].sort((left, right) => right.points - left.points).slice(0, 3);
  const hiddenFindingCount = Math.max(0, result.findings.length - visibleFindings.length);
  return (
    <View style={[styles.riskPanel, { backgroundColor: levelBg(theme, result.level), borderColor: color }]}>
      <View style={styles.riskTop}>
        <View style={styles.riskTextColumn}>
          <Text style={[styles.riskLabel, { color }]}>{labelForLevel(result.level)}</Text>
          <Text style={styles.riskHeadline}>{result.headline}</Text>
        </View>
        <View style={[styles.scoreBadge, { borderColor: color }]}>
          <Text style={[styles.scoreText, { color }]}>{result.score}</Text>
        </View>
      </View>
      <Text style={styles.cardBody}>{result.summary}</Text>
      {result.findings.length ? (
        <View style={styles.findings}>
          <Text style={styles.nextTitle}>Main signs</Text>
          {visibleFindings.map((finding) => (
            <View key={finding.id} style={styles.findingRow}>
              <AlertTriangle size={theme.icon(19)} color={levelColor(theme, finding.severity)} />
              <View style={styles.findingText}>
                <Text style={styles.findingTitle}>{finding.title}</Text>
                <Text style={styles.findingDetail}>{finding.detail}</Text>
              </View>
            </View>
          ))}
          {hiddenFindingCount ? <Text style={styles.smallMuted}>Plus {hiddenFindingCount} more sign{hiddenFindingCount === 1 ? '' : 's'}.</Text> : null}
        </View>
      ) : null}
      <View style={styles.scriptBox}>
        <Text style={styles.scriptLabel}>Say this if pressured</Text>
        <Text style={styles.scriptText}>{result.script}</Text>
      </View>
      <Text style={styles.nextTitle}>Do next</Text>
      {result.nextSteps.map((step) => (
        <View key={step} style={styles.bulletRow}>
          <CheckCircle2 size={theme.icon(19)} color={theme.colors.brand} />
          <Text style={styles.bulletText}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

function CallRiskPanel({ result }: { result: CallRiskResult }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const color = levelColor(theme, result.level);
  return (
    <View style={[styles.riskPanel, { backgroundColor: levelBg(theme, result.level), borderColor: color }]}>
      <View style={styles.riskTop}>
        <View style={styles.riskTextColumn}>
          <Text style={[styles.riskLabel, { color }]}>{result.uncertain ? 'Possible risk' : 'Spoofing / scam check'}</Text>
          <Text style={styles.riskHeadline}>{result.headline}</Text>
        </View>
        <View style={[styles.scoreBadge, { borderColor: color }]}>
          <Text style={[styles.scoreText, { color }]}>{result.score}</Text>
        </View>
      </View>
      <Text style={styles.cardBody}>{result.summary}</Text>
      {result.reasons.length ? (
        <>
          <Text style={styles.nextTitle}>What we noticed</Text>
          {result.reasons.map((reason) => (
            <View key={reason} style={styles.bulletRow}>
              <AlertTriangle size={theme.icon(18)} color={color} />
              <Text style={styles.bulletText}>{reason}</Text>
            </View>
          ))}
        </>
      ) : null}
      <View style={styles.scriptBox}>
        <Text style={styles.scriptLabel}>Recommendation</Text>
        <Text style={styles.scriptText}>{result.recommendation}</Text>
      </View>
    </View>
  );
}

function ToggleRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <AnimatedToggle value={value} onValueChange={onValueChange} accessibilityLabel={label} />
    </View>
  );
}

function SecondaryAction({ icon: Icon, label, onPress, disabled }: { icon: LucideIcon; label: string; onPress: () => void; disabled?: boolean }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <TouchableOpacity style={[styles.secondaryAction, disabled && styles.disabledButton]} onPress={onPress} disabled={disabled} activeOpacity={0.75} accessibilityRole="button" accessibilityState={{ disabled: Boolean(disabled) }}>
      <Icon size={theme.icon(19)} color={disabled ? theme.colors.faint : theme.colors.brand} />
      <Text style={[styles.secondaryActionText, disabled && styles.disabledText]}>{label}</Text>
    </TouchableOpacity>
  );
}

function AttachmentLabel({ icon: Icon, label, onClear }: { icon: LucideIcon; label: string; onClear: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.attachment}>
      <View style={styles.toolIcon}>
        <Icon size={theme.icon(22)} color={theme.colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.attachmentTitle}>{label}</Text>
        <Text style={styles.smallMuted}>Attached on this device</Text>
      </View>
      <TouchableOpacity onPress={onClear} accessibilityLabel="Remove attachment">
        <X size={theme.icon(22)} color={theme.colors.muted} />
      </TouchableOpacity>
    </View>
  );
}

function ProgressBar({ value }: { value: number }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const width = `${Math.max(4, Math.min(100, value))}%` as DimensionValue;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width }]} />
    </View>
  );
}

function ActivityRow({ event, detailed }: { event: DetectionEvent; detailed?: boolean }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const color = levelColor(theme, event.level);
  const iconMap: Record<DetectionKind, LucideIcon> = {
    call: PhoneCall,
    message: MessageCircle,
    email: Mail,
    link: LinkIcon,
    payment: CreditCard,
    summary: ShieldCheck,
    lesson: GraduationCap,
  };
  const Icon = iconMap[event.kind] ?? ShieldAlert;
  return (
    <View style={styles.activityRow}>
      <View style={[styles.activityIcon, { backgroundColor: levelBg(theme, event.level) }]}>
        <Icon size={theme.icon(22)} color={color} strokeWidth={2.3} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.activityTitle}>{event.title}</Text>
        {detailed ? <Text style={styles.activityDetail}>{event.detail}</Text> : null}
        <Text style={styles.activityMeta}>
          {event.uncertain ? 'Possible risk · ' : ''}
          {formatWhen(event.date)}
        </Text>
      </View>
      {!event.read ? <View style={[styles.unreadDot, { backgroundColor: color }]} /> : null}
    </View>
  );
}

function TrustedContactStrip({
  contacts,
  onCall,
  onText,
  onManage,
  urgent,
}: {
  contacts: TrustedContact[];
  onCall: (contact: TrustedContact) => void;
  onText: (contact: TrustedContact) => void;
  onManage?: () => void;
  urgent?: boolean;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={[styles.contactStrip, urgent && styles.contactStripUrgent]}>
      <View style={styles.sectionHeader}>
        <Text style={styles.contactStripTitle}>Someone you trust</Text>
        {onManage ? (
          <TouchableOpacity style={styles.textLinkButton} onPress={onManage} accessibilityRole="button">
            <Text style={styles.inlineLink}>{contacts.length ? 'Edit' : 'Add'}</Text>
            <ChevronRight size={theme.icon(18)} color={theme.colors.brand} strokeWidth={2.6} />
          </TouchableOpacity>
        ) : !contacts.length ? (
          <Text style={styles.smallMuted}>None saved</Text>
        ) : null}
      </View>
      {contacts.length ? (
        contacts.map((contact) => (
          <View key={contact.id} style={styles.contactRow}>
            <View style={styles.contactAvatar}>
              <Users size={theme.icon(22)} color={theme.colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactName}>{contact.name || contact.label}</Text>
              <Text style={styles.smallMuted}>{contact.phone}</Text>
            </View>
            <TouchableOpacity style={styles.iconButton} onPress={() => onCall(contact)} accessibilityLabel={`Call ${contact.name || contact.label}`}>
              <Phone size={theme.icon(21)} color={theme.colors.brand} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => onText(contact)} accessibilityLabel={`Text ${contact.name || contact.label}`}>
              <MessageCircle size={theme.icon(21)} color={theme.colors.brand} />
            </TouchableOpacity>
          </View>
        ))
      ) : (
        <Text style={styles.cardBody}>Add a daughter, son, caregiver, friend, or neighbor so help is one tap away.</Text>
      )}
    </View>
  );
}

function WeekRow({
  module,
  createdAt,
  completed,
  onOpen,
}: {
  module: WeeklyModule;
  createdAt: string;
  completed: boolean;
  onOpen: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const unlocked = isWeekUnlocked(createdAt, module.week);
  const days = daysUntilUnlock(createdAt, module.week);

  return (
    <TouchableOpacity
      style={[styles.weekRow, !unlocked && styles.weekRowLocked]}
      onPress={onOpen}
      disabled={!unlocked}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Week ${module.week}. ${module.title}. ${unlocked ? '' : `Unlocks in ${days} days.`}`}
    >
      <View
        style={[
          styles.weekBadge,
          completed && { backgroundColor: theme.colors.brand },
          !unlocked && { backgroundColor: theme.colors.surfaceMuted },
        ]}
      >
        {completed ? (
          <CheckCircle2 size={theme.icon(24)} color={theme.colors.onBrand} strokeWidth={2.6} />
        ) : unlocked ? (
          <Text style={styles.weekBadgeText}>{module.week}</Text>
        ) : (
          <Lock size={theme.icon(20)} color={theme.colors.faint} strokeWidth={2.4} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.weekEyebrow}>
          Week {module.week} · {module.minutes} min{completed ? ' · Done' : ''}
        </Text>
        <Text style={[styles.weekTitle, !unlocked && { color: theme.colors.muted }]}>{module.title}</Text>
        {!unlocked ? <Text style={styles.weekLocked}>Opens in {days} day{days === 1 ? '' : 's'}</Text> : null}
      </View>
      {unlocked ? <ChevronRight size={theme.icon(24)} color={theme.colors.faint} strokeWidth={2.4} /> : null}
    </TouchableOpacity>
  );
}

// Full-screen lesson: read the lesson, then a 5-question quiz, then a result.
function LessonScreen({ module, onBack }: { module: WeeklyModule; onBack: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { progress, updateProgress, recordStreak } = useApp();
  const [phase, setPhase] = useState<'read' | 'quiz' | 'done'>('read');
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);

  const total = module.quiz.length;
  const question = module.quiz[qIndex];
  const answered = selected !== null;
  const isLast = qIndex === total - 1;

  function choose(index: number) {
    if (answered) return;
    setSelected(index);
    if (index === question.answerIndex) setCorrect((c) => c + 1);
  }

  function next() {
    if (!isLast) {
      setQIndex((i) => i + 1);
      setSelected(null);
      return;
    }
    const score = Math.round((correct / total) * 100);
    updateProgress({
      ...progress,
      completedWeeks: progress.completedWeeks.includes(module.id) ? progress.completedWeeks : [...progress.completedWeeks, module.id],
      quizScores: { ...progress.quizScores, [module.id]: score },
      currentWeek: Math.max(progress.currentWeek, module.week + 1),
      lastActivity: new Date().toISOString(),
    });
    recordStreak();
    setPhase('done');
  }

  if (phase === 'read') {
    return (
      <View style={styles.lessonStack}>
        <Text style={styles.lessonEyebrow}>Week {module.week} · {module.minutes} min read</Text>
        <Text style={styles.lessonTitle}>{module.title}</Text>
        <Text style={styles.lessonBody}>{module.lesson}</Text>

        <View style={styles.lessonKeyPoints}>
          {module.keyPoints.map((point) => (
            <View key={point} style={styles.lessonBullet}>
              <CheckCircle2 size={theme.icon(24)} color={theme.colors.brand} strokeWidth={2.4} />
              <Text style={styles.lessonBulletText}>{point}</Text>
            </View>
          ))}
        </View>

        <View style={styles.exampleBox}>
          <View style={styles.exampleHead}>
            <AlertTriangle size={theme.icon(20)} color={theme.colors.high} strokeWidth={2.4} />
            <Text style={styles.scriptLabel}>Real example · {module.example.channel}</Text>
          </View>
          <Text style={styles.exampleText}>{module.example.message}</Text>
        </View>

        <Text style={styles.lessonBody}>{module.explanation}</Text>

        <View style={styles.rememberBox}>
          <ShieldCheck size={theme.icon(24)} color={theme.colors.accent} strokeWidth={2.4} />
          <Text style={styles.rememberBoxText}>{module.remember}</Text>
        </View>

        <Btn label={`Start the quiz (${total} questions)`} icon={Trophy} onPress={() => setPhase('quiz')} />
      </View>
    );
  }

  if (phase === 'quiz') {
    return (
      <View style={styles.lessonStack}>
        <View style={styles.quizHeader}>
          <Text style={styles.quizCounter}>Question {qIndex + 1} of {total}</Text>
          <ProgressBarTinted value={Math.round(((qIndex + (answered ? 1 : 0)) / total) * 100)} />
        </View>
        <Text style={styles.quizPromptBig}>{question.prompt}</Text>
        <View style={styles.quizOptions}>
          {question.options.map((option, index) => {
            const isCorrect = answered && index === question.answerIndex;
            const isWrong = answered && index === selected && index !== question.answerIndex;
            return (
              <TouchableOpacity
                key={option}
                style={[styles.quizOption, isCorrect && styles.quizCorrect, isWrong && styles.quizWrong]}
                onPress={() => choose(index)}
                disabled={answered}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                {isCorrect ? (
                  <CheckCircle2 size={theme.icon(24)} color={theme.colors.low} strokeWidth={2.5} />
                ) : isWrong ? (
                  <X size={theme.icon(24)} color={theme.colors.danger} strokeWidth={2.5} />
                ) : (
                  <Circle size={theme.icon(24)} color={theme.colors.muted} strokeWidth={2.2} />
                )}
                <Text style={styles.quizOptionText}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {answered ? (
          <View style={[styles.quizFeedback, { borderColor: selected === question.answerIndex ? theme.colors.low : theme.colors.high }]}>
            <Text style={[styles.quizFeedbackTitle, { color: selected === question.answerIndex ? theme.colors.low : theme.colors.high }]}>
              {selected === question.answerIndex ? 'Correct!' : 'Not quite'}
            </Text>
            <Text style={styles.cardBody}>{question.whyCorrect}</Text>
          </View>
        ) : null}
        {answered ? <Btn label={isLast ? 'See my results' : 'Next question'} icon={ChevronRight} onPress={next} /> : null}
      </View>
    );
  }

  const score = Math.round((correct / total) * 100);
  const passed = score >= 60;
  return (
    <View style={styles.lessonStack}>
      <View style={styles.resultBox}>
        <View style={[styles.resultIcon, { backgroundColor: passed ? theme.colors.lowTint : theme.colors.warnTint }]}>
          {passed ? (
            <Trophy size={theme.icon(44)} color={theme.colors.low} strokeWidth={2.2} />
          ) : (
            <GraduationCap size={theme.icon(44)} color={theme.colors.warn} strokeWidth={2.2} />
          )}
        </View>
        <Text style={styles.resultScore}>{correct} / {total}</Text>
        <Text style={styles.resultTitle}>{passed ? 'Well done!' : 'Good effort'}</Text>
        <Text style={styles.resultText}>
          {passed ? 'You’ve got the key ideas for this week. This lesson is now complete.' : 'Review the lesson and try again any time — practice builds the habit.'}
        </Text>
      </View>
      <Btn label="Back to lessons" icon={BookOpen} onPress={onBack} />
      <Btn
        label="Read the lesson again"
        variant="secondary"
        icon={ChevronLeft}
        onPress={() => {
          setPhase('read');
          setQIndex(0);
          setSelected(null);
          setCorrect(0);
        }}
      />
    </View>
  );
}

// A green-track progress bar used inside lessons.
function ProgressBarTinted({ value }: { value: number }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const width = `${Math.max(4, Math.min(100, value))}%` as DimensionValue;
  return (
    <View style={styles.quizTrack}>
      <View style={[styles.quizFill, { width }]} />
    </View>
  );
}

// First-run feature walkthrough shown once after onboarding.
function Walkthrough({ onLesson, onQuickCheck, onSkip }: { onLesson: () => void; onQuickCheck: () => void; onSkip: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [index, setIndex] = useState(0);
  const slides = [
    {
      icon: ShieldCheck,
      title: 'This is your scam shield',
      body: 'When a call, message, or email doesn’t feel right, Shield Our Elders helps you slow down and check it calmly. You always have time.',
    },
    {
      icon: LayoutGrid,
      title: 'Check anything in seconds',
      body: 'From Checks, look at a message, phone call, link, QR code, number, or payment. We explain the warning signs in plain words.',
    },
    {
      icon: Siren,
      title: 'Help when it counts',
      body: 'Tap the big red “I think this is a scam” button any time for calm, step-by-step safety actions — and reach a trusted person fast.',
    },
    {
      icon: GraduationCap,
      title: 'Learn and play each week',
      body: 'A short new lesson opens weekly, plus 8 fun games. Play each week to build a streak and grow your confidence.',
    },
  ];
  const total = slides.length;
  const isReady = index === total; // final choice screen
  const slide = slides[Math.min(index, total - 1)];
  const Icon = slide.icon;

  return (
    <View style={styles.walkRoot}>
      <View style={styles.walkTop}>
        <TouchableOpacity onPress={onSkip} accessibilityRole="button" style={styles.walkSkip}>
          <Text style={styles.walkSkipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {isReady ? (
        <Reveal key="ready" style={styles.walkBody}>
          <View style={[styles.walkIcon, { backgroundColor: theme.colors.low }]}>
            <CheckCircle2 size={theme.icon(56)} color={theme.colors.onBrand} strokeWidth={2.2} />
          </View>
          <Text style={styles.walkTitle}>You’re all set!</Text>
          <Text style={styles.walkText}>Would you like to try a quick check now, or start your first weekly lesson?</Text>
        </Reveal>
      ) : (
        <Reveal key={index} style={styles.walkBody}>
          <View style={styles.walkIcon}>
            <Icon size={theme.icon(56)} color={theme.colors.onBrand} strokeWidth={2.2} />
          </View>
          <Text style={styles.walkTitle}>{slide.title}</Text>
          <Text style={styles.walkText}>{slide.body}</Text>
          <View style={styles.walkDots}>
            {slides.map((_, i) => (
              <View key={i} style={[styles.walkDot, i === index && styles.walkDotActive]} />
            ))}
          </View>
        </Reveal>
      )}

      <View style={styles.walkFooter}>
        {isReady ? (
          <>
            <Btn label="Try a quick check" icon={ShieldCheck} onPress={onQuickCheck} />
            <View style={{ height: theme.space.sm }} />
            <Btn label="Start my first lesson" variant="secondary" icon={GraduationCap} onPress={onLesson} />
            <TouchableOpacity onPress={onSkip} style={styles.walkSkip} accessibilityRole="button">
              <Text style={[styles.walkSkipText, { textAlign: 'center' }]}>Maybe later — go to home</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Btn label="Next" icon={ChevronRight} onPress={() => setIndex((i) => i + 1)} />
        )}
      </View>
    </View>
  );
}


// ---------------------------------------------------------------------------
// Themed styles
// ---------------------------------------------------------------------------

// Bottom-nav item: color-only active state (no background pill), big icon,
// gentle press animation.
function NavItem({ icon: Icon, label, active, onPress }: { icon: LucideIcon; label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const scale = useRef(new Animated.Value(1)).current;
  const press = (to: number) => {
    if (theme.reducedMotion) return;
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 60, bounciness: 8 }).start();
  };
  const color = active ? theme.colors.brand : theme.colors.muted;
  return (
    <TouchableOpacity
      style={styles.navItem}
      onPress={onPress}
      onPressIn={() => press(0.88)}
      onPressOut={() => press(1)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Icon size={theme.icon(34)} color={color} strokeWidth={active ? 2.1 : 1.8} />
      </Animated.View>
      <Text style={[styles.navLabel, { color }, active && styles.navLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ScrambleGame({ onBack, onWin }: { onBack: () => void; onWin: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [index, setIndex] = useState(0);
  const word = scrambleWords[index % scrambleWords.length];
  const [scrambled, setScrambled] = useState<string[]>(() => shuffle(word.word.split('')));
  const [picked, setPicked] = useState<number[]>([]);
  const answer = picked.map((i) => scrambled[i]).join('');
  const filled = picked.length === word.word.length;
  const solved = filled && answer === word.word;
  useEffect(() => {
    if (solved) onWin();
  }, [solved, onWin]);

  function goNext() {
    const next = index + 1;
    const w = scrambleWords[next % scrambleWords.length];
    setIndex(next);
    setScrambled(shuffle(w.word.split('')));
    setPicked([]);
  }

  return (
    <View style={styles.stack}>
      <TouchableOpacity style={styles.gameBack} onPress={onBack} accessibilityRole="button">
        <ChevronLeft size={theme.icon(22)} color={theme.colors.brand} strokeWidth={2.2} />
        <Text style={styles.gameBackText}>All games</Text>
      </TouchableOpacity>
      <Text style={styles.gameHeading}>Word Scramble</Text>
      <View style={styles.hintBox}>
        <Text style={styles.hintLabel}>Hint</Text>
        <Text style={styles.hintText}>{word.hint}</Text>
      </View>
      <View style={styles.answerRow}>
        {word.word.split('').map((_, i) => (
          <View key={i} style={[styles.answerSlot, solved && styles.answerSlotSolved, filled && !solved && styles.answerSlotWrong]}>
            <Text style={styles.answerSlotText}>{picked[i] != null ? scrambled[picked[i]] : ''}</Text>
          </View>
        ))}
      </View>
      <View style={styles.tileRow}>
        {scrambled.map((ch, i) => {
          const used = picked.includes(i);
          return (
            <TouchableOpacity
              key={i}
              disabled={used || solved}
              style={[styles.letterTile, used && styles.letterTileUsed]}
              onPress={() => setPicked((p) => [...p, i])}
              accessibilityLabel={`letter ${ch}`}
            >
              <Text style={[styles.letterText, used && { color: theme.colors.faint }]}>{ch}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {solved ? (
        <View style={styles.gameWin}>
          <CheckCircle2 size={theme.icon(24)} color={theme.colors.low} strokeWidth={2.2} />
          <Text style={styles.gameWinText}>Correct — {word.word}!</Text>
        </View>
      ) : null}
      <View style={styles.buttonRow}>
        <SecondaryAction icon={X} label="Undo" onPress={() => setPicked((p) => p.slice(0, -1))} disabled={!picked.length || solved} />
        <SecondaryAction icon={Shuffle} label="Reshuffle" onPress={() => { setScrambled(shuffle(word.word.split(''))); setPicked([]); }} disabled={solved} />
      </View>
      {solved ? <Btn label="Next word" icon={ChevronRight} onPress={goNext} /> : null}
    </View>
  );
}

function MatchGame({ onBack, onWin }: { onBack: () => void; onWin: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [meanings] = useState(() => shuffle(matchPairs));
  const [selected, setSelected] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string | null>(null);
  const allDone = matched.length === matchPairs.length;
  useEffect(() => {
    if (allDone) onWin();
  }, [allDone, onWin]);

  function tapMeaning(term: string) {
    if (matched.includes(term)) return;
    if (!selected) return;
    if (selected === term) {
      setMatched((m) => [...m, term]);
      setSelected(null);
    } else {
      setWrong(term);
      setTimeout(() => setWrong(null), 700);
    }
  }

  return (
    <View style={styles.stack}>
      <TouchableOpacity style={styles.gameBack} onPress={onBack} accessibilityRole="button">
        <ChevronLeft size={theme.icon(22)} color={theme.colors.brand} strokeWidth={2.2} />
        <Text style={styles.gameBackText}>All games</Text>
      </TouchableOpacity>
      <Text style={styles.gameHeading}>Match the Term</Text>
      <Text style={styles.screenIntro}>Tap a term on the left, then its meaning on the right.</Text>
      <View style={styles.matchGrid}>
        <View style={styles.matchCol}>
          {matchPairs.map((p) => {
            const done = matched.includes(p.term);
            const sel = selected === p.term;
            return (
              <TouchableOpacity
                key={p.term}
                disabled={done}
                onPress={() => setSelected(p.term)}
                style={[styles.matchChip, sel && styles.matchChipSel, done && styles.matchChipDone]}
                accessibilityRole="button"
              >
                <Text style={[styles.matchChipText, done && { color: theme.colors.onBrand }]}>{p.term}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.matchCol}>
          {meanings.map((p) => {
            const done = matched.includes(p.term);
            const isWrong = wrong === p.term;
            return (
              <TouchableOpacity
                key={p.term}
                disabled={done}
                onPress={() => tapMeaning(p.term)}
                style={[styles.matchChip, styles.matchMeaning, done && styles.matchChipDone, isWrong && styles.matchChipWrong]}
                accessibilityRole="button"
              >
                <Text style={[styles.matchMeaningText, done && { color: theme.colors.onBrand }]}>{p.meaning}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      {allDone ? (
        <View style={styles.gameWin}>
          <CheckCircle2 size={theme.icon(24)} color={theme.colors.low} strokeWidth={2.2} />
          <Text style={styles.gameWinText}>All matched — well done!</Text>
        </View>
      ) : null}
    </View>
  );
}

// Side drawer that slides in from the right, with a fading dark overlay.
function SideDrawer({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [mounted, setMounted] = useState(visible);
  const anim = useRef(new Animated.Value(0)).current;
  const panelW = Math.min(360, Math.round(Dimensions.get('window').width * 0.84));

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, { toValue: 1, duration: theme.reducedMotion ? 0 : 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: theme.reducedMotion ? 0 : 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, anim, theme.reducedMotion]);

  if (!mounted) return null;
  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [panelW + 40, 0] });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.drawerOverlay, { opacity: anim }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close menu" />
      </Animated.View>
      <Animated.View style={[styles.drawerPanel, { width: panelW, transform: [{ translateX }] }]}>{children}</Animated.View>
    </Modal>
  );
}

// Entrance animation: fade + slide up on mount, with optional stagger delay.
function Reveal({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: object }) {
  const theme = useTheme();
  const a = useRef(new Animated.Value(theme.reducedMotion ? 1 : 0)).current;
  useEffect(() => {
    if (theme.reducedMotion) {
      a.setValue(1);
      return;
    }
    const anim = Animated.timing(a, { toValue: 1, duration: 400, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [a, delay, theme.reducedMotion]);
  return (
    <Animated.View style={[style, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

function StreakBanner({ streak, best }: { streak: number; best: number }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (theme.reducedMotion || streak <= 0) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.14, duration: 720, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 720, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, streak, theme.reducedMotion]);
  return (
    <View style={styles.streakBanner}>
      <Animated.View style={[styles.streakFlame, { transform: [{ scale: pulse }] }]}>
        <Flame size={theme.icon(30)} color={theme.colors.white} strokeWidth={2} />
      </Animated.View>
      <View style={{ flex: 1 }}>
        <Text style={styles.streakNumber}>{streak > 0 ? `${streak}-week streak` : 'Start your streak'}</Text>
        <Text style={styles.streakSub}>
          {streak > 0 ? `Best: ${best} week${best === 1 ? '' : 's'} · play this week to keep it` : 'Play any game this week to begin'}
        </Text>
      </View>
    </View>
  );
}

function GameTile({ icon: Icon, title, tone, onPress }: { icon: LucideIcon; title: string; tone: number; onPress: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const scale = useRef(new Animated.Value(1)).current;
  const press = (to: number) => {
    if (theme.reducedMotion) return;
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  };
  const tints = [theme.colors.brandTint, theme.colors.infoTint, theme.colors.accentTint, theme.colors.warnTint];
  const fgs = [theme.colors.brand, theme.colors.info, theme.colors.accent, theme.colors.warn];
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable style={styles.gameTile} onPress={onPress} onPressIn={() => press(0.95)} onPressOut={() => press(1)} accessibilityRole="button" accessibilityLabel={title}>
        <View style={[styles.gameTileIcon, { backgroundColor: tints[tone % 4] }]}>
          <Icon size={theme.icon(32)} color={fgs[tone % 4]} strokeWidth={2} />
        </View>
        <Text style={styles.gameTileTitle}>{title}</Text>
      </Pressable>
    </Animated.View>
  );
}

function GameHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <>
      <TouchableOpacity style={styles.gameBack} onPress={onBack} accessibilityRole="button">
        <ChevronLeft size={theme.icon(22)} color={theme.colors.brand} strokeWidth={2.2} />
        <Text style={styles.gameBackText}>All games</Text>
      </TouchableOpacity>
      <Text style={styles.gameHeading}>{title}</Text>
    </>
  );
}

function GameResult({ score, total, onReplay, onBack }: { score: number; total: number; onReplay: () => void; onBack: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const pct = total ? Math.round((score / total) * 100) : 0;
  const great = pct >= 70;
  return (
    <View style={{ gap: theme.space.lg }}>
      <View style={styles.resultBox}>
        <View style={[styles.resultIcon, { backgroundColor: great ? theme.colors.lowTint : theme.colors.warnTint }]}>
          {great ? <Trophy size={theme.icon(44)} color={theme.colors.low} strokeWidth={2.2} /> : <Flame size={theme.icon(44)} color={theme.colors.warn} strokeWidth={2.2} />}
        </View>
        <Text style={styles.resultScore}>{score} / {total}</Text>
        <Text style={styles.resultTitle}>{great ? 'Great job!' : 'Nice effort!'}</Text>
        <Text style={styles.resultText}>You earned this week’s streak. Come back next week to keep it growing.</Text>
      </View>
      <Btn label="Play again" icon={Shuffle} onPress={onReplay} />
      <Btn label="All games" variant="secondary" icon={ChevronLeft} onPress={onBack} />
    </View>
  );
}

function CrosswordGame({ onBack, onWin }: { onBack: () => void; onWin: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { solution, numberAt, cellsForClue } = useMemo(() => buildCrossword(), []);
  const inputRef = useRef<TextInput>(null);
  const [cells, setCells] = useState<Record<string, string>>({});
  const [activeIdx, setActiveIdx] = useState(0);

  const activeClue = crosswordClues[activeIdx];
  const activeCells = cellsForClue[`${activeClue.number}-${activeClue.direction}`];
  const activeValue = activeCells.map((k) => cells[k] ?? '').join('');
  const solved = Object.keys(solution).every((k) => (cells[k] ?? '') === solution[k]);
  useEffect(() => {
    if (solved) onWin();
  }, [solved, onWin]);

  function onType(text: string) {
    const clean = text.toUpperCase().replace(/[^A-Z]/g, '').slice(0, activeCells.length);
    setCells((prev) => {
      const next = { ...prev };
      activeCells.forEach((k, i) => {
        next[k] = clean[i] ?? '';
      });
      return next;
    });
  }

  function selectCell(r: number, c: number) {
    const k = cellKey(r, c);
    const matches = crosswordClues
      .map((cl, i) => ({ i, cells: cellsForClue[`${cl.number}-${cl.direction}`] }))
      .filter((m) => m.cells.includes(k))
      .map((m) => m.i);
    if (!matches.length) return;
    const other = matches.find((i) => i !== activeIdx);
    setActiveIdx(activeCells.includes(k) && other != null ? other : matches[0]);
    inputRef.current?.focus();
  }

  return (
    <View style={styles.stack}>
      <GameHeader title="Crossword" onBack={onBack} />
      <Text style={styles.screenIntro}>Tap a clue, then type its answer. Fill every square to win.</Text>

      <View style={styles.crossGrid}>
        {Array.from({ length: crosswordSize }).map((_, r) => (
          <View key={r} style={styles.crossRow}>
            {Array.from({ length: crosswordSize }).map((_, c) => {
              const k = cellKey(r, c);
              if (solution[k] == null) return <View key={c} style={styles.crossBlank} />;
              const active = activeCells.includes(k);
              const letter = cells[k] ?? '';
              const correct = solved || (letter !== '' && letter === solution[k]);
              return (
                <TouchableOpacity
                  key={c}
                  style={[styles.crossCell, active && styles.crossCellActive, correct && styles.crossCellCorrect]}
                  onPress={() => selectCell(r, c)}
                  activeOpacity={0.8}
                >
                  {numberAt[k] ? <Text style={styles.crossNum}>{numberAt[k]}</Text> : null}
                  <Text style={styles.crossLetter}>{letter}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      <TextInput
        ref={inputRef}
        style={styles.crossInput}
        value={activeValue}
        onChangeText={onType}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={activeCells.length}
        placeholder={`Answer for ${activeClue.number} ${activeClue.direction}`}
        placeholderTextColor={theme.colors.faint}
      />

      <View style={{ gap: theme.space.sm }}>
        {crosswordClues.map((cl, i) => {
          const done = cellsForClue[`${cl.number}-${cl.direction}`].every((k) => (cells[k] ?? '') === solution[k]);
          return (
            <TouchableOpacity
              key={`${cl.number}-${cl.direction}`}
              onPress={() => {
                setActiveIdx(i);
                inputRef.current?.focus();
              }}
              style={[styles.clueRow, i === activeIdx && styles.clueRowActive]}
              accessibilityRole="button"
            >
              <Text style={styles.clueNum}>
                {cl.number} {cl.direction === 'across' ? 'Across' : 'Down'}
              </Text>
              <Text style={[styles.clueText, done && { color: theme.colors.low }]}>
                {cl.clue}
                {done ? '  ✓' : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {solved ? (
        <View style={styles.gameWin}>
          <CheckCircle2 size={theme.icon(24)} color={theme.colors.low} strokeWidth={2.2} />
          <Text style={styles.gameWinText}>Solved — well done!</Text>
        </View>
      ) : null}
    </View>
  );
}

function TrueFalseGame({ onBack, onWin }: { onBack: () => void; onWin: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [items] = useState(() => shuffle(trueFalseItems));
  const [idx, setIdx] = useState(0);
  const [choice, setChoice] = useState<boolean | null>(null);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    if (finished) onWin();
  }, [finished, onWin]);

  if (finished) {
    return (
      <View style={styles.stack}>
        <GameHeader title="True or False" onBack={onBack} />
        <GameResult
          score={correct}
          total={items.length}
          onReplay={() => {
            setIdx(0);
            setChoice(null);
            setCorrect(0);
            setFinished(false);
          }}
          onBack={onBack}
        />
      </View>
    );
  }

  const item = items[idx];
  const answered = choice !== null;
  const right = choice === item.answer;

  return (
    <View style={styles.stack}>
      <GameHeader title="True or False" onBack={onBack} />
      <Text style={styles.gameCounter}>Question {idx + 1} of {items.length}</Text>
      <View style={styles.tfCard}>
        <Text style={styles.tfStatement}>{item.statement}</Text>
      </View>
      <View style={styles.tfButtons}>
        <TouchableOpacity
          style={[styles.tfBtn, answered && item.answer === true && styles.tfBtnCorrect, answered && choice === true && item.answer !== true && styles.tfBtnWrong]}
          disabled={answered}
          onPress={() => {
            setChoice(true);
            if (item.answer === true) setCorrect((c) => c + 1);
          }}
        >
          <CheckCircle2 size={theme.icon(26)} color={theme.colors.low} strokeWidth={2.2} />
          <Text style={styles.tfBtnText}>True</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tfBtn, answered && item.answer === false && styles.tfBtnCorrect, answered && choice === false && item.answer !== false && styles.tfBtnWrong]}
          disabled={answered}
          onPress={() => {
            setChoice(false);
            if (item.answer === false) setCorrect((c) => c + 1);
          }}
        >
          <X size={theme.icon(26)} color={theme.colors.danger} strokeWidth={2.2} />
          <Text style={styles.tfBtnText}>False</Text>
        </TouchableOpacity>
      </View>
      {answered ? (
        <View style={[styles.quizFeedback, { borderColor: right ? theme.colors.low : theme.colors.high }]}>
          <Text style={[styles.quizFeedbackTitle, { color: right ? theme.colors.low : theme.colors.high }]}>{right ? 'Correct!' : 'Not quite'}</Text>
          <Text style={styles.cardBody}>{item.why}</Text>
        </View>
      ) : null}
      {answered ? (
        <Btn
          label={idx === items.length - 1 ? 'See my score' : 'Next'}
          icon={ChevronRight}
          onPress={() => {
            if (idx === items.length - 1) setFinished(true);
            else {
              setIdx((i) => i + 1);
              setChoice(null);
            }
          }}
        />
      ) : null}
    </View>
  );
}

function FillBlankGame({ onBack, onWin }: { onBack: () => void; onWin: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [items] = useState(() => shuffle(fillBlankItems).map((it) => ({ ...it, options: shuffle(it.options) })));
  const [idx, setIdx] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    if (finished) onWin();
  }, [finished, onWin]);

  if (finished) {
    return (
      <View style={styles.stack}>
        <GameHeader title="Fill the Blank" onBack={onBack} />
        <GameResult
          score={correct}
          total={items.length}
          onReplay={() => {
            setIdx(0);
            setChoice(null);
            setCorrect(0);
            setFinished(false);
          }}
          onBack={onBack}
        />
      </View>
    );
  }

  const item = items[idx];
  const answered = choice !== null;

  return (
    <View style={styles.stack}>
      <GameHeader title="Fill the Blank" onBack={onBack} />
      <Text style={styles.gameCounter}>Question {idx + 1} of {items.length}</Text>
      <View style={styles.tfCard}>
        <Text style={styles.fillSentence}>
          {item.before} <Text style={styles.fillBlankMark}>{answered ? item.answer : '_____'}</Text> {item.after}
        </Text>
      </View>
      <View style={{ gap: theme.space.sm }}>
        {item.options.map((opt) => {
          const isRight = opt === item.answer;
          const chosen = choice === opt;
          return (
            <TouchableOpacity
              key={opt}
              disabled={answered}
              style={[
                styles.fillOption,
                answered && isRight && { borderColor: theme.colors.low, backgroundColor: theme.colors.lowTint },
                answered && chosen && !isRight && { borderColor: theme.colors.danger, backgroundColor: theme.colors.dangerTint },
              ]}
              onPress={() => {
                setChoice(opt);
                if (isRight) setCorrect((c) => c + 1);
              }}
              accessibilityRole="button"
            >
              {answered && isRight ? (
                <CheckCircle2 size={theme.icon(20)} color={theme.colors.low} strokeWidth={2.2} />
              ) : answered && chosen ? (
                <X size={theme.icon(20)} color={theme.colors.danger} strokeWidth={2.2} />
              ) : (
                <Circle size={theme.icon(20)} color={theme.colors.muted} strokeWidth={2} />
              )}
              <Text style={styles.fillOptionText}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {answered ? (
        <Btn
          label={idx === items.length - 1 ? 'See my score' : 'Next'}
          icon={ChevronRight}
          onPress={() => {
            if (idx === items.length - 1) setFinished(true);
            else {
              setIdx((i) => i + 1);
              setChoice(null);
            }
          }}
        />
      ) : null}
    </View>
  );
}

function RedFlagGame({ onBack, onWin }: { onBack: () => void; onWin: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [items] = useState(() => shuffle(redFlagItems));
  const [idx, setIdx] = useState(0);
  const [choice, setChoice] = useState<boolean | null>(null);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    if (finished) onWin();
  }, [finished, onWin]);

  if (finished) {
    return (
      <View style={styles.stack}>
        <GameHeader title="Red Flag Rush" onBack={onBack} />
        <GameResult
          score={correct}
          total={items.length}
          onReplay={() => {
            setIdx(0);
            setChoice(null);
            setCorrect(0);
            setFinished(false);
          }}
          onBack={onBack}
        />
      </View>
    );
  }

  const item = items[idx];
  const answered = choice !== null;
  const right = choice === item.scam;

  return (
    <View style={styles.stack}>
      <GameHeader title="Red Flag Rush" onBack={onBack} />
      <Text style={styles.gameCounter}>{idx + 1} of {items.length} · Is it a scam?</Text>
      <View style={styles.rfCard}>
        <Text style={styles.rfText}>{item.text}</Text>
      </View>
      <View style={styles.tfButtons}>
        <TouchableOpacity
          style={[styles.tfBtn, answered && item.scam === true && styles.tfBtnCorrect, answered && choice === true && !item.scam && styles.tfBtnWrong]}
          disabled={answered}
          onPress={() => {
            setChoice(true);
            if (item.scam) setCorrect((c) => c + 1);
          }}
        >
          <Flag size={theme.icon(26)} color={theme.colors.danger} strokeWidth={2.2} />
          <Text style={styles.tfBtnText}>Scam</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tfBtn, answered && item.scam === false && styles.tfBtnCorrect, answered && choice === false && item.scam && styles.tfBtnWrong]}
          disabled={answered}
          onPress={() => {
            setChoice(false);
            if (!item.scam) setCorrect((c) => c + 1);
          }}
        >
          <ShieldCheck size={theme.icon(26)} color={theme.colors.low} strokeWidth={2.2} />
          <Text style={styles.tfBtnText}>Safe</Text>
        </TouchableOpacity>
      </View>
      {answered ? (
        <View style={[styles.quizFeedback, { borderColor: right ? theme.colors.low : theme.colors.high }]}>
          <Text style={[styles.quizFeedbackTitle, { color: right ? theme.colors.low : theme.colors.high }]}>{right ? 'Correct!' : item.scam ? 'This one was a scam' : 'This one was safe'}</Text>
        </View>
      ) : null}
      {answered ? (
        <Btn
          label={idx === items.length - 1 ? 'See my score' : 'Next'}
          icon={ChevronRight}
          onPress={() => {
            if (idx === items.length - 1) setFinished(true);
            else {
              setIdx((i) => i + 1);
              setChoice(null);
            }
          }}
        />
      ) : null}
    </View>
  );
}

interface MemoryCard {
  id: string;
  term: string;
}

function MemoryGame({ onBack, onWin }: { onBack: () => void; onWin: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [deck] = useState<MemoryCard[]>(() => shuffle(memoryTerms.flatMap((t) => [{ id: `${t}-a`, term: t }, { id: `${t}-b`, term: t }])));
  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const busy = useRef(false);
  const allDone = matched.length === memoryTerms.length;
  useEffect(() => {
    if (allDone) onWin();
  }, [allDone, onWin]);

  function tap(card: MemoryCard) {
    if (busy.current || matched.includes(card.term) || flipped.includes(card.id) || flipped.length === 2) return;
    const nextFlipped = [...flipped, card.id];
    setFlipped(nextFlipped);
    if (nextFlipped.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = nextFlipped;
      const termA = deck.find((c) => c.id === a)?.term;
      const termB = deck.find((c) => c.id === b)?.term;
      if (termA && termA === termB) {
        setMatched((m) => [...m, termA]);
        setFlipped([]);
      } else {
        busy.current = true;
        setTimeout(() => {
          setFlipped([]);
          busy.current = false;
        }, 900);
      }
    }
  }

  return (
    <View style={styles.stack}>
      <GameHeader title="Memory Match" onBack={onBack} />
      <Text style={styles.gameCounter}>Find the matching pairs · {moves} move{moves === 1 ? '' : 's'}</Text>
      <View style={styles.memGrid}>
        {deck.map((card) => {
          const show = flipped.includes(card.id) || matched.includes(card.term);
          const done = matched.includes(card.term);
          return (
            <TouchableOpacity
              key={card.id}
              style={[styles.memCard, show && styles.memCardUp, done && styles.memCardDone]}
              onPress={() => tap(card)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={show ? card.term : 'hidden card'}
            >
              {show ? (
                <Text style={[styles.memCardText, done && { color: theme.colors.onBrand }]}>{card.term}</Text>
              ) : (
                <ShieldCheck size={theme.icon(28)} color={theme.colors.faint} strokeWidth={2} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      {allDone ? (
        <View style={styles.gameWin}>
          <CheckCircle2 size={theme.icon(24)} color={theme.colors.low} strokeWidth={2.2} />
          <Text style={styles.gameWinText}>All pairs found in {moves} moves!</Text>
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    app: { flex: 1, backgroundColor: t.colors.bg },

    header: {
      paddingTop: Platform.OS === 'ios' ? 58 : 44,
      paddingBottom: t.space.md,
      paddingHorizontal: t.space.xl,
      backgroundColor: t.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.line,
    },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: t.space.md },
    logoMark: {
      width: t.tap(48),
      height: t.tap(48),
      borderRadius: t.radius.md,
      backgroundColor: t.colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
      ...t.shadow('soft'),
    },
    brandName: { fontSize: t.font('h2'), fontWeight: t.weight.bold, color: t.colors.ink, letterSpacing: -0.4 },
    brandTagline: { fontSize: t.font('label'), color: t.colors.muted, fontWeight: t.weight.medium, marginTop: 1 },
    headerNavRow: { gap: t.space.xs },
    backButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 2 },
    backIcon: { transform: [{ rotate: '180deg' }], marginRight: 2 },
    backText: { fontSize: t.font('bodySm'), fontWeight: t.weight.semibold, color: t.colors.brand },
    title: { fontSize: t.font('h1'), fontWeight: t.weight.bold, color: t.colors.ink, letterSpacing: -0.5 },

    scroll: { flex: 1 },
    scrollContent: { padding: t.space.xl, paddingBottom: 140 },
    screenTransition: { flex: 1 },
    stack: { gap: t.space.lg },

    homeHero: { gap: t.space.sm, marginTop: t.space.xs },
    homeHeroTitle: { fontSize: t.font('display'), lineHeight: t.lineHeight('display'), fontWeight: t.weight.bold, color: t.colors.ink, letterSpacing: -0.7 },
    homeHeroText: { fontSize: t.font('body'), lineHeight: t.lineHeight('body'), color: t.colors.inkSoft, fontWeight: t.weight.regular },

    emergencyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.space.md,
      backgroundColor: t.colors.danger,
      borderRadius: t.radius.lg,
      padding: t.space.lg,
      ...t.shadow('card'),
    },
    emergencyIcon: { width: t.tap(54), height: t.tap(54), borderRadius: t.radius.md, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
    emergencyTitle: { fontSize: t.font('h3'), fontWeight: t.weight.bold, color: t.colors.onBrand, letterSpacing: -0.3 },
    emergencySub: { fontSize: t.font('bodySm'), color: 'rgba(255,255,255,0.9)', marginTop: 2, fontWeight: t.weight.regular },

    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitle: { fontSize: t.font('h3'), fontWeight: t.weight.bold, color: t.colors.ink, letterSpacing: -0.3 },
    textLinkButton: { flexDirection: 'row', alignItems: 'center', gap: 1, paddingVertical: 4, paddingLeft: t.space.sm },
    inlineLink: { fontSize: t.font('bodySm'), fontWeight: t.weight.semibold, color: t.colors.brand },

    tileGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: t.space.md },
    tileWrap: { width: '48%' },
    tile: {
      width: '100%',
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      borderColor: t.colors.line,
      padding: t.space.lg,
      gap: 6,
      ...t.shadow('soft'),
    },
    tileIcon: { width: t.tap(52), height: t.tap(52), borderRadius: t.radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    tileTitle: { fontSize: t.font('body'), fontWeight: t.weight.bold, color: t.colors.ink, letterSpacing: -0.2 },
    tileDetail: { fontSize: t.font('label'), color: t.colors.muted, fontWeight: t.weight.medium },

    screenIntro: { fontSize: t.font('body'), lineHeight: t.lineHeight('body'), color: t.colors.inkSoft, fontWeight: t.weight.medium },
    screenIntroNarrow: { flex: 1, fontSize: t.font('bodySm'), lineHeight: t.lineHeight('bodySm'), color: t.colors.muted, fontWeight: t.weight.medium, paddingRight: t.space.md },

    toolSection: { gap: t.space.md },
    toolSectionTitle: { fontSize: t.font('h3'), fontWeight: t.weight.bold, color: t.colors.ink, letterSpacing: -0.3 },
    toolIcon: { width: t.tap(46), height: t.tap(46), borderRadius: t.radius.sm, backgroundColor: t.colors.brandTint, alignItems: 'center', justifyContent: 'center' },


    input: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.md,
      borderWidth: 1.5,
      borderColor: t.colors.lineStrong,
      paddingHorizontal: t.space.lg,
      paddingVertical: 15,
      fontSize: t.font('body'),
      color: t.colors.ink,
      minHeight: t.tap(54),
    },
    textArea: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.md,
      borderWidth: 1.5,
      borderColor: t.colors.lineStrong,
      padding: t.space.lg,
      fontSize: t.font('body'),
      lineHeight: t.lineHeight('body'),
      color: t.colors.ink,
      minHeight: t.tap(140),
    },
    textAreaSmall: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.md,
      borderWidth: 1.5,
      borderColor: t.colors.lineStrong,
      padding: t.space.lg,
      fontSize: t.font('bodySm'),
      lineHeight: t.lineHeight('bodySm'),
      color: t.colors.ink,
      minHeight: t.tap(92),
    },

    buttonRow: { flexDirection: 'row', gap: t.space.sm },
    secondaryButtonWide: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.space.sm,
      backgroundColor: t.colors.brandTint,
      borderRadius: t.radius.md,
      paddingVertical: 16,
      paddingHorizontal: t.space.lg,
      minHeight: t.tap(52),
    },
    secondaryButtonWideText: { fontSize: t.font('bodySm'), fontWeight: t.weight.semibold, color: t.colors.brand },
    disabledButton: { backgroundColor: t.colors.bgWarm, borderColor: t.colors.line, shadowOpacity: 0, elevation: 0 },
    disabledText: { color: t.colors.faint },
    secondaryAction: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.line,
      borderRadius: t.radius.pill,
      paddingVertical: 12,
      paddingHorizontal: t.space.md,
      minHeight: t.tap(48),
    },
    secondaryActionText: { fontSize: t.font('label'), fontWeight: t.weight.semibold, color: t.colors.brand },

    attachment: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.space.md,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.colors.line,
      padding: t.space.md,
    },
    attachmentImage: { width: 54, height: 54, borderRadius: t.radius.sm, backgroundColor: t.colors.bgWarm },
    attachmentTitle: { fontSize: t.font('bodySm'), fontWeight: t.weight.semibold, color: t.colors.ink },

    aiActionBox: { gap: t.space.sm },
    errorText: { fontSize: t.font('label'), color: t.colors.danger, fontWeight: t.weight.medium, lineHeight: t.lineHeight('label') },
    smallMuted: { fontSize: t.font('label'), color: t.colors.muted, fontWeight: t.weight.regular, lineHeight: t.lineHeight('label') },

    cardTitle: { fontSize: t.font('h3'), fontWeight: t.weight.bold, color: t.colors.ink, letterSpacing: -0.3 },
    cardBody: { fontSize: t.font('bodySm'), lineHeight: t.lineHeight('bodySm'), color: t.colors.inkSoft, fontWeight: t.weight.regular },

    scriptBox: { backgroundColor: t.colors.surfaceMuted, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.line, padding: t.space.md, gap: 4 },
    scriptLabel: { fontSize: t.font('tiny'), fontWeight: t.weight.bold, color: t.colors.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
    scriptText: { fontSize: t.font('bodySm'), lineHeight: t.lineHeight('bodySm'), color: t.colors.ink, fontWeight: t.weight.medium },


    riskPanel: { borderRadius: t.radius.lg, borderWidth: 1, padding: t.space.lg, gap: t.space.md, ...t.shadow('soft') },
    riskTop: { flexDirection: 'row', alignItems: 'center', gap: t.space.md },
    riskTextColumn: { flex: 1, gap: 3 },
    riskLabel: { fontSize: t.font('tiny'), fontWeight: t.weight.bold, letterSpacing: 1.1, textTransform: 'uppercase' },
    riskHeadline: { fontSize: t.font('h3'), fontWeight: t.weight.bold, color: t.colors.ink, letterSpacing: -0.3 },
    scoreBadge: { minWidth: t.tap(56), height: t.tap(56), borderRadius: t.radius.md, borderWidth: 2, backgroundColor: t.colors.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
    scoreText: { fontSize: t.font('h2'), fontWeight: t.weight.bold },
    findings: { gap: t.space.sm },
    findingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: t.space.sm },
    findingText: { flex: 1, gap: 1 },
    findingTitle: { fontSize: t.font('bodySm'), fontWeight: t.weight.semibold, color: t.colors.ink },
    findingDetail: { fontSize: t.font('label'), lineHeight: t.lineHeight('label'), color: t.colors.inkSoft },
    nextTitle: { fontSize: t.font('label'), fontWeight: t.weight.bold, color: t.colors.ink, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },
    bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: t.space.sm },
    bulletText: { flex: 1, fontSize: t.font('bodySm'), lineHeight: t.lineHeight('bodySm'), color: t.colors.inkSoft },

    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: t.space.md,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.colors.line,
      paddingVertical: 14,
      paddingHorizontal: t.space.lg,
      minHeight: t.tap(58),
    },
    toggleLabel: { flex: 1, fontSize: t.font('bodySm'), fontWeight: t.weight.medium, color: t.colors.ink, lineHeight: t.lineHeight('bodySm') },

    stopPanel: { alignItems: 'center', gap: t.space.sm, backgroundColor: t.colors.dangerTint, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.dangerBorder, padding: t.space.xl },
    stopTitle: { fontSize: t.font('h1'), fontWeight: t.weight.bold, color: t.colors.danger, letterSpacing: -0.4, textAlign: 'center' },
    stopText: { fontSize: t.font('body'), lineHeight: t.lineHeight('body'), color: t.colors.inkSoft, textAlign: 'center', fontWeight: t.weight.medium },
    stepRow: { flexDirection: 'row', alignItems: 'center', gap: t.space.md, backgroundColor: t.colors.surface, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.line, padding: t.space.md, ...t.shadow('soft') },
    stepNumber: { width: t.tap(38), height: t.tap(38), borderRadius: 19, backgroundColor: t.colors.brand, alignItems: 'center', justifyContent: 'center' },
    stepNumberText: { fontSize: t.font('bodySm'), fontWeight: t.weight.bold, color: t.colors.onBrand },
    stepText: { flex: 1, fontSize: t.font('bodySm'), lineHeight: t.lineHeight('bodySm'), color: t.colors.ink, fontWeight: t.weight.medium },

    refreshButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.colors.brandTint, borderRadius: t.radius.pill, paddingVertical: 8, paddingHorizontal: t.space.md },
    refreshText: { fontSize: t.font('label'), fontWeight: t.weight.semibold, color: t.colors.brand },
    newsItem: { backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.line, padding: t.space.lg, gap: 6, ...t.shadow('soft') },
    newsTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    newsSource: { fontSize: t.font('tiny'), fontWeight: t.weight.bold, color: t.colors.brand, textTransform: 'uppercase', letterSpacing: 0.8 },
    newsDate: { fontSize: t.font('tiny'), color: t.colors.faint, fontWeight: t.weight.medium },
    newsTitle: { fontSize: t.font('h3'), fontWeight: t.weight.bold, color: t.colors.ink, lineHeight: t.lineHeight('h3'), letterSpacing: -0.3 },

    confidencePanel: { backgroundColor: t.colors.brand, borderRadius: t.radius.lg, padding: t.space.lg, gap: t.space.sm, ...t.shadow('card') },
    metricTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    metricLabel: { fontSize: t.font('label'), fontWeight: t.weight.semibold, color: 'rgba(255,255,255,0.92)' },
    metricSmall: { fontSize: t.font('label'), color: 'rgba(255,255,255,0.78)', fontWeight: t.weight.medium },
    metricValue: { fontSize: Math.round(t.font('display') * 1.25), fontWeight: t.weight.bold, color: t.colors.white, letterSpacing: -1 },
    practiceCard: { backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.line, padding: t.space.lg, gap: t.space.sm, ...t.shadow('soft') },
    practiceText: { fontSize: t.font('body'), lineHeight: t.lineHeight('body'), color: t.colors.ink, fontWeight: t.weight.medium },
    optionGrid: { flexDirection: 'row', gap: t.space.sm },
    answerButton: { flex: 1, alignItems: 'center', gap: 6, backgroundColor: t.colors.surface, borderRadius: t.radius.md, borderWidth: 1.5, borderColor: t.colors.line, paddingVertical: t.space.md, paddingHorizontal: t.space.sm, minHeight: t.tap(72) },
    answerSelected: { borderColor: t.colors.info, backgroundColor: t.colors.infoTint },
    answerCorrect: { borderColor: t.colors.low, backgroundColor: t.colors.lowTint },
    answerWrong: { borderColor: t.colors.danger, backgroundColor: t.colors.dangerTint },
    answerText: { fontSize: t.font('bodySm'), fontWeight: t.weight.semibold, color: t.colors.ink },
    feedbackPanel: { backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.line, padding: t.space.lg, gap: t.space.md, ...t.shadow('soft') },
    feedbackTitle: { fontSize: t.font('h3'), fontWeight: t.weight.bold, color: t.colors.low, letterSpacing: -0.3 },
    feedbackWrong: { color: t.colors.high },

    progressTrack: { height: 10, borderRadius: t.radius.pill, backgroundColor: 'rgba(255,255,255,0.28)', overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: t.radius.pill, backgroundColor: t.colors.white },


    bottomNav: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-around',
      backgroundColor: t.colors.surface,
      borderTopWidth: 1,
      borderTopColor: t.colors.line,
      paddingTop: t.space.md,
      paddingBottom: Platform.OS === 'ios' ? 30 : t.space.lg,
      paddingHorizontal: t.space.sm,
    },
    navItem: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 2 },
    navIconWrap: { width: t.tap(66), height: t.tap(44), borderRadius: t.radius.pill, alignItems: 'center', justifyContent: 'center' },
    navIconWrapActive: { backgroundColor: t.colors.brandTint },
    navBadge: {
      position: 'absolute',
      top: -2,
      right: 8,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: t.colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: t.colors.surface,
    },
    navBadgeText: { fontSize: 10, fontWeight: t.weight.bold, color: t.colors.white },
    navLabel: { fontSize: t.font('label'), fontWeight: t.weight.semibold, color: t.colors.muted },
    navLabelActive: { color: t.colors.brand, fontWeight: t.weight.bold },

    // Home ------------------------------------------------------------------
    homeStack: { gap: t.space.xl },
    homeSectionTitle: { fontSize: t.font('h2'), fontWeight: t.weight.bold, color: t.colors.ink, letterSpacing: -0.4 },
    homeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: t.space.md },
    homeTileWrap: { width: '48%' },
    homeTile: {
      width: '100%',
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      borderColor: t.colors.line,
      paddingVertical: t.space.lg,
      paddingHorizontal: t.space.md,
      alignItems: 'center',
      gap: 6,
      ...t.shadow('soft'),
    },
    homeTileIcon: { width: t.tap(66), height: t.tap(66), borderRadius: t.radius.pill, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
    homeTileTitle: { fontSize: t.font('body'), fontWeight: t.weight.bold, color: t.colors.ink, textAlign: 'center' },
    homeTileDetail: { fontSize: t.font('label'), color: t.colors.muted, fontWeight: t.weight.medium, textAlign: 'center' },
    lessonCta: { flexDirection: 'row', alignItems: 'center', gap: t.space.md, backgroundColor: t.colors.brand, borderRadius: t.radius.lg, padding: t.space.lg, ...t.shadow('card') },
    lessonCtaIcon: { width: t.tap(54), height: t.tap(54), borderRadius: t.radius.md, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
    lessonCtaEyebrow: { fontSize: t.font('label'), fontWeight: t.weight.semibold, color: 'rgba(255,255,255,0.85)' },
    lessonCtaTitle: { fontSize: t.font('h3'), fontWeight: t.weight.bold, color: t.colors.onBrand, letterSpacing: -0.2, marginTop: 1 },

    // Checks ----------------------------------------------------------------
    checksStack: { gap: t.space.xxl },
    checkGroup: { gap: t.space.md },
    checkGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: t.space.md },
    checkGroupIcon: { width: t.tap(46), height: t.tap(46), borderRadius: t.radius.sm, backgroundColor: t.colors.brandTint, alignItems: 'center', justifyContent: 'center' },
    checkGroupTitle: { fontSize: t.font('h2'), fontWeight: t.weight.bold, color: t.colors.ink, letterSpacing: -0.4 },
    checkGroupSubtitle: { fontSize: t.font('label'), color: t.colors.muted, fontWeight: t.weight.medium, marginTop: 1 },
    checkGroupBody: { backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.line, overflow: 'hidden', ...t.shadow('soft') },
    toolRow: { flexDirection: 'row', alignItems: 'center', gap: t.space.md, paddingVertical: t.space.md, paddingHorizontal: t.space.lg, minHeight: t.tap(74) },
    toolRowDivider: { borderBottomWidth: 1, borderBottomColor: t.colors.line },
    toolRowIcon: { width: t.tap(50), height: t.tap(50), borderRadius: t.radius.sm, alignItems: 'center', justifyContent: 'center' },
    toolRowTitle: { fontSize: t.font('body'), fontWeight: t.weight.semibold, color: t.colors.ink },
    toolRowDetail: { fontSize: t.font('label'), color: t.colors.muted, fontWeight: t.weight.medium, marginTop: 1 },

    // Learn list ------------------------------------------------------------
    learnStack: { gap: t.space.lg },
    weekRow: { flexDirection: 'row', alignItems: 'center', gap: t.space.md, backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.line, padding: t.space.lg, minHeight: t.tap(78), ...t.shadow('soft') },
    weekRowLocked: { backgroundColor: t.colors.surfaceMuted },
    weekLocked: { fontSize: t.font('label'), color: t.colors.muted, fontWeight: t.weight.semibold, marginTop: 3 },

    // Full-screen lesson ----------------------------------------------------
    lessonStack: { gap: t.space.xl, paddingBottom: t.space.lg },
    lessonEyebrow: { fontSize: t.font('label'), fontWeight: t.weight.bold, color: t.colors.brand, textTransform: 'uppercase', letterSpacing: 0.6 },
    lessonTitle: { fontSize: t.font('h1'), fontWeight: t.weight.bold, color: t.colors.ink, letterSpacing: -0.5, lineHeight: t.lineHeight('h1') },
    lessonBody: { fontSize: t.font('body'), lineHeight: t.lineHeight('body'), color: t.colors.inkSoft, fontWeight: t.weight.regular },
    lessonKeyPoints: { gap: t.space.md, backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.line, padding: t.space.lg, ...t.shadow('soft') },
    lessonBullet: { flexDirection: 'row', alignItems: 'flex-start', gap: t.space.md },
    lessonBulletText: { flex: 1, fontSize: t.font('bodySm'), lineHeight: t.lineHeight('bodySm'), color: t.colors.ink, fontWeight: t.weight.medium },
    exampleHead: { flexDirection: 'row', alignItems: 'center', gap: t.space.sm },
    exampleText: { fontSize: t.font('body'), lineHeight: t.lineHeight('body'), color: t.colors.ink, fontWeight: t.weight.medium, fontStyle: 'italic' },
    rememberBox: { flexDirection: 'row', alignItems: 'center', gap: t.space.md, backgroundColor: t.colors.accentTint, borderRadius: t.radius.md, padding: t.space.lg },
    rememberBoxText: { flex: 1, fontSize: t.font('bodySm'), lineHeight: t.lineHeight('bodySm'), color: t.colors.accent, fontWeight: t.weight.bold },

    // Full-screen quiz ------------------------------------------------------
    quizHeader: { gap: t.space.sm },
    quizCounter: { fontSize: t.font('label'), fontWeight: t.weight.bold, color: t.colors.brand, textTransform: 'uppercase', letterSpacing: 0.6 },
    quizPromptBig: { fontSize: t.font('h2'), fontWeight: t.weight.bold, color: t.colors.ink, lineHeight: t.lineHeight('h2'), letterSpacing: -0.3 },
    quizOptions: { gap: t.space.md },
    quizTrack: { height: 12, borderRadius: t.radius.pill, backgroundColor: t.colors.surfaceMuted, overflow: 'hidden' },
    quizFill: { height: '100%', borderRadius: t.radius.pill, backgroundColor: t.colors.brand },

    // Lesson result ---------------------------------------------------------
    resultBox: { alignItems: 'center', gap: t.space.sm, backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.line, padding: t.space.xxl, ...t.shadow('soft') },
    resultIcon: { width: t.tap(90), height: t.tap(90), borderRadius: t.radius.pill, alignItems: 'center', justifyContent: 'center', marginBottom: t.space.xs },
    resultScore: { fontSize: Math.round(t.font('display') * 1.15), fontWeight: t.weight.bold, color: t.colors.ink, letterSpacing: -1 },
    resultTitle: { fontSize: t.font('h2'), fontWeight: t.weight.bold, color: t.colors.ink },
    resultText: { fontSize: t.font('body'), lineHeight: t.lineHeight('body'), color: t.colors.inkSoft, textAlign: 'center', fontWeight: t.weight.regular },

    // Walkthrough -----------------------------------------------------------
    walkRoot: { flex: 1, backgroundColor: t.colors.bg },
    walkTop: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 54, paddingHorizontal: t.space.xl },
    walkSkip: { padding: t.space.sm },
    walkSkipText: { fontSize: t.font('bodySm'), fontWeight: t.weight.semibold, color: t.colors.muted },
    walkBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: t.space.xl, gap: t.space.lg },
    walkIcon: { width: t.tap(108), height: t.tap(108), borderRadius: t.radius.pill, backgroundColor: t.colors.brand, alignItems: 'center', justifyContent: 'center', ...t.shadow('card') },
    walkTitle: { fontSize: t.font('h1'), fontWeight: t.weight.bold, color: t.colors.ink, textAlign: 'center', letterSpacing: -0.5 },
    walkText: { fontSize: t.font('body'), lineHeight: t.lineHeight('body'), color: t.colors.inkSoft, textAlign: 'center', fontWeight: t.weight.regular },
    walkDots: { flexDirection: 'row', gap: 8, marginTop: t.space.sm },
    walkDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: t.colors.lineStrong },
    walkDotActive: { width: 24, backgroundColor: t.colors.brand },
    walkFooter: { padding: t.space.xl, paddingBottom: 34 },

    // Header actions --------------------------------------------------------
    homeHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: t.space.md },
    headerTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: t.space.sm },
    headerIconBtn: { width: t.tap(46), height: t.tap(46), borderRadius: t.radius.pill, backgroundColor: t.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
    headerBadge: {
      position: 'absolute',
      top: 4,
      right: 4,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: t.colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: t.colors.surface,
    },
    headerBadgeText: { fontSize: 10, fontWeight: t.weight.bold, color: t.colors.white },

    // Emergency page --------------------------------------------------------
    emergencyHero: { alignItems: 'center', gap: t.space.sm, backgroundColor: t.colors.danger, borderRadius: t.radius.lg, padding: t.space.xl, ...t.shadow('card') },
    emergencyHeroIcon: { width: t.tap(72), height: t.tap(72), borderRadius: t.radius.pill, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
    emergencyHeroTitle: { fontSize: t.font('h1'), fontWeight: t.weight.bold, color: t.colors.onBrand, textAlign: 'center', letterSpacing: -0.4 },
    emergencyHeroText: { fontSize: t.font('body'), lineHeight: t.lineHeight('body'), color: 'rgba(255,255,255,0.92)', textAlign: 'center', fontWeight: t.weight.medium },
    emergencySectionTitle: { fontSize: t.font('h3'), fontWeight: t.weight.bold, color: t.colors.ink, letterSpacing: -0.3, marginTop: t.space.xs },
    dontList: { backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.dangerBorder, overflow: 'hidden', ...t.shadow('soft') },
    dontRow: { flexDirection: 'row', alignItems: 'center', gap: t.space.md, padding: t.space.lg },
    dontRowDivider: { borderBottomWidth: 1, borderBottomColor: t.colors.line },
    dontIcon: { width: t.tap(48), height: t.tap(48), borderRadius: t.radius.sm, backgroundColor: t.colors.dangerTint, alignItems: 'center', justifyContent: 'center' },
    dontText: { flex: 1, fontSize: t.font('bodySm'), lineHeight: t.lineHeight('bodySm'), color: t.colors.ink, fontWeight: t.weight.semibold },
    emergencyInfo: { flexDirection: 'row', alignItems: 'center', gap: t.space.md, backgroundColor: t.colors.brandTint, borderRadius: t.radius.md, padding: t.space.lg },
    emergencyInfoText: { flex: 1, fontSize: t.font('bodySm'), lineHeight: t.lineHeight('bodySm'), color: t.colors.ink, fontWeight: t.weight.medium },

    // About Us --------------------------------------------------------------
    aboutHeroWrap: { alignItems: 'center', gap: t.space.xs, marginBottom: t.space.sm },
    aboutLogo: { width: t.tap(84), height: t.tap(84), borderRadius: t.radius.lg, backgroundColor: t.colors.brand, alignItems: 'center', justifyContent: 'center', marginBottom: t.space.xs, ...t.shadow('card') },
    aboutTitle: { fontSize: t.font('h1'), fontWeight: t.weight.bold, color: t.colors.ink, letterSpacing: -0.4 },
    aboutTagline: { fontSize: t.font('bodySm'), color: t.colors.muted, fontWeight: t.weight.semibold },

    // Games -----------------------------------------------------------------
    gameCard: { flexDirection: 'row', alignItems: 'center', gap: t.space.md, backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.line, padding: t.space.lg, minHeight: t.tap(80), ...t.shadow('soft') },
    gameIcon: { width: t.tap(56), height: t.tap(56), borderRadius: t.radius.md, backgroundColor: t.colors.brandTint, alignItems: 'center', justifyContent: 'center' },
    gameTitle: { fontSize: t.font('h3'), fontWeight: t.weight.bold, color: t.colors.ink, letterSpacing: -0.2 },
    gameDetail: { fontSize: t.font('label'), color: t.colors.muted, fontWeight: t.weight.medium, marginTop: 2 },
    gameBack: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
    gameBackText: { fontSize: t.font('bodySm'), fontWeight: t.weight.semibold, color: t.colors.brand },
    gameHeading: { fontSize: t.font('h1'), fontWeight: t.weight.bold, color: t.colors.ink, letterSpacing: -0.4 },
    hintBox: { backgroundColor: t.colors.surfaceMuted, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.line, padding: t.space.lg, gap: 4 },
    hintLabel: { fontSize: t.font('tiny'), fontWeight: t.weight.bold, color: t.colors.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
    hintText: { fontSize: t.font('body'), lineHeight: t.lineHeight('body'), color: t.colors.ink, fontWeight: t.weight.medium },
    answerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm, justifyContent: 'center' },
    answerSlot: { minWidth: t.tap(40), height: t.tap(52), paddingHorizontal: 6, borderRadius: t.radius.sm, borderWidth: 2, borderColor: t.colors.lineStrong, backgroundColor: t.colors.surface, alignItems: 'center', justifyContent: 'center' },
    answerSlotSolved: { borderColor: t.colors.low, backgroundColor: t.colors.lowTint },
    answerSlotWrong: { borderColor: t.colors.danger, backgroundColor: t.colors.dangerTint },
    answerSlotText: { fontSize: t.font('h2'), fontWeight: t.weight.bold, color: t.colors.ink },
    tileRow: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm, justifyContent: 'center' },
    letterTile: { width: t.tap(52), height: t.tap(52), borderRadius: t.radius.sm, backgroundColor: t.colors.brand, alignItems: 'center', justifyContent: 'center', ...t.shadow('soft') },
    letterTileUsed: { backgroundColor: t.colors.surfaceMuted },
    letterText: { fontSize: t.font('h2'), fontWeight: t.weight.bold, color: t.colors.onBrand },
    gameWin: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: t.space.sm, backgroundColor: t.colors.lowTint, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.low, padding: t.space.lg },
    gameWinText: { fontSize: t.font('h3'), fontWeight: t.weight.bold, color: t.colors.low },
    matchGrid: { flexDirection: 'row', gap: t.space.md },
    matchCol: { flex: 1, gap: t.space.md },
    matchChip: { minHeight: t.tap(70), borderRadius: t.radius.md, borderWidth: 1.5, borderColor: t.colors.line, backgroundColor: t.colors.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: t.space.md, paddingVertical: t.space.sm },
    matchMeaning: {},
    matchChipSel: { borderColor: t.colors.brand, backgroundColor: t.colors.brandTintSoft },
    matchChipDone: { borderColor: t.colors.low, backgroundColor: t.colors.low },
    matchChipWrong: { borderColor: t.colors.danger, backgroundColor: t.colors.dangerTint },
    matchChipText: { fontSize: t.font('bodySm'), fontWeight: t.weight.bold, color: t.colors.ink, textAlign: 'center' },
    matchMeaningText: { fontSize: t.font('label'), fontWeight: t.weight.medium, color: t.colors.ink, textAlign: 'center', lineHeight: t.lineHeight('label') },

    // Streak + game hub -----------------------------------------------------
    streakBanner: { flexDirection: 'row', alignItems: 'center', gap: t.space.md, backgroundColor: t.colors.brand, borderRadius: t.radius.lg, padding: t.space.lg, ...t.shadow('card') },
    streakFlame: { width: t.tap(52), height: t.tap(52), borderRadius: t.radius.pill, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
    streakNumber: { fontSize: t.font('h2'), fontWeight: t.weight.bold, color: t.colors.onBrand, letterSpacing: -0.3 },
    streakSub: { fontSize: t.font('label'), color: 'rgba(255,255,255,0.9)', fontWeight: t.weight.medium, marginTop: 1 },
    homeStreakChip: { flexDirection: 'row', alignItems: 'center', gap: t.space.md, backgroundColor: t.colors.brandTint, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.brandTintSoft, paddingVertical: t.space.md, paddingHorizontal: t.space.lg },
    homeStreakIcon: { width: t.tap(38), height: t.tap(38), borderRadius: t.radius.pill, backgroundColor: t.colors.brand, alignItems: 'center', justifyContent: 'center' },
    homeStreakText: { flex: 1, fontSize: t.font('bodySm'), fontWeight: t.weight.bold, color: t.colors.brandDark },
    gameTileWrap: { width: '48%' },
    gameTile: { backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.line, paddingVertical: t.space.lg, paddingHorizontal: t.space.md, alignItems: 'center', gap: t.space.sm, minHeight: t.tap(128), justifyContent: 'center', ...t.shadow('soft') },
    gameTileIcon: { width: t.tap(60), height: t.tap(60), borderRadius: t.radius.pill, alignItems: 'center', justifyContent: 'center' },
    gameTileTitle: { fontSize: t.font('bodySm'), fontWeight: t.weight.bold, color: t.colors.ink, textAlign: 'center' },
    gameCounter: { fontSize: t.font('label'), fontWeight: t.weight.bold, color: t.colors.brand, textTransform: 'uppercase', letterSpacing: 0.6 },

    // Crossword -------------------------------------------------------------
    crossGrid: { alignSelf: 'center', gap: 4 },
    crossRow: { flexDirection: 'row', gap: 4 },
    crossBlank: { width: t.tap(52), height: t.tap(52) },
    crossCell: { width: t.tap(52), height: t.tap(52), borderRadius: t.radius.xs, borderWidth: 1.5, borderColor: t.colors.lineStrong, backgroundColor: t.colors.surface, alignItems: 'center', justifyContent: 'center' },
    crossCellActive: { borderColor: t.colors.brand, backgroundColor: t.colors.brandTintSoft },
    crossCellCorrect: { borderColor: t.colors.low, backgroundColor: t.colors.lowTint },
    crossNum: { position: 'absolute', top: 2, left: 3, fontSize: 10, fontWeight: t.weight.bold, color: t.colors.muted },
    crossLetter: { fontSize: t.font('h3'), fontWeight: t.weight.bold, color: t.colors.ink },
    crossInput: { backgroundColor: t.colors.surface, borderWidth: 1.5, borderColor: t.colors.lineStrong, borderRadius: t.radius.md, paddingHorizontal: t.space.lg, minHeight: t.tap(54), fontSize: t.font('body'), color: t.colors.ink, letterSpacing: 2, textAlign: 'center' },
    clueRow: { backgroundColor: t.colors.surface, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.line, padding: t.space.md, gap: 2 },
    clueRowActive: { borderColor: t.colors.brand, backgroundColor: t.colors.brandTintSoft },
    clueNum: { fontSize: t.font('tiny'), fontWeight: t.weight.bold, color: t.colors.brand, textTransform: 'uppercase', letterSpacing: 0.6 },
    clueText: { fontSize: t.font('bodySm'), fontWeight: t.weight.medium, color: t.colors.ink, lineHeight: t.lineHeight('bodySm') },

    // True/False, Red Flag --------------------------------------------------
    tfCard: { backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.line, padding: t.space.xl, ...t.shadow('soft') },
    tfStatement: { fontSize: t.font('h3'), fontWeight: t.weight.semibold, color: t.colors.ink, lineHeight: t.lineHeight('h3') },
    tfButtons: { flexDirection: 'row', gap: t.space.md },
    tfBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: t.space.sm, minHeight: t.tap(64), borderRadius: t.radius.md, borderWidth: 1.5, borderColor: t.colors.line, backgroundColor: t.colors.surface },
    tfBtnCorrect: { borderColor: t.colors.low, backgroundColor: t.colors.lowTint },
    tfBtnWrong: { borderColor: t.colors.danger, backgroundColor: t.colors.dangerTint },
    tfBtnText: { fontSize: t.font('body'), fontWeight: t.weight.bold, color: t.colors.ink },
    rfCard: { backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.line, padding: t.space.xl, minHeight: t.tap(120), justifyContent: 'center', ...t.shadow('soft') },
    rfText: { fontSize: t.font('h3'), fontWeight: t.weight.medium, color: t.colors.ink, lineHeight: t.lineHeight('h3'), textAlign: 'center' },

    // Fill the blank --------------------------------------------------------
    fillSentence: { fontSize: t.font('h3'), fontWeight: t.weight.medium, color: t.colors.ink, lineHeight: t.lineHeight('h2') },
    fillBlankMark: { fontWeight: t.weight.bold, color: t.colors.brand },
    fillOption: { flexDirection: 'row', alignItems: 'center', gap: t.space.sm, minHeight: t.tap(56), borderWidth: 1.5, borderColor: t.colors.line, borderRadius: t.radius.md, backgroundColor: t.colors.surface, paddingHorizontal: t.space.lg },
    fillOptionText: { flex: 1, fontSize: t.font('body'), fontWeight: t.weight.semibold, color: t.colors.ink },

    // Memory match ----------------------------------------------------------
    memGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm, justifyContent: 'center' },
    memCard: { width: '30%', aspectRatio: 1, borderRadius: t.radius.md, borderWidth: 1.5, borderColor: t.colors.line, backgroundColor: t.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', padding: 4 },
    memCardUp: { backgroundColor: t.colors.brandTintSoft, borderColor: t.colors.brand },
    memCardDone: { backgroundColor: t.colors.low, borderColor: t.colors.low },
    memCardText: { fontSize: t.font('bodySm'), fontWeight: t.weight.bold, color: t.colors.ink, textAlign: 'center' },

    // Side drawer -----------------------------------------------------------
    drawerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.colors.overlay },
    drawerPanel: { position: 'absolute', top: 0, right: 0, bottom: 0, backgroundColor: t.colors.bg, borderTopLeftRadius: t.radius.xl, borderBottomLeftRadius: t.radius.xl, ...t.shadow('raised') },
    drawerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.space.md,
      paddingTop: 56,
      paddingBottom: t.space.md,
      paddingHorizontal: t.space.lg,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.line,
    },
    drawerLogo: { width: t.tap(40), height: t.tap(40), borderRadius: t.radius.sm, backgroundColor: t.colors.brand, alignItems: 'center', justifyContent: 'center' },
    drawerTitle: { flex: 1, fontSize: t.font('h2'), fontWeight: t.weight.bold, color: t.colors.ink, letterSpacing: -0.3 },

    modalScreen: { flex: 1, backgroundColor: t.colors.bg },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: Platform.OS === 'ios' ? 58 : 44,
      paddingBottom: t.space.md,
      paddingHorizontal: t.space.xl,
      backgroundColor: t.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.line,
    },
    modalTitle: { fontSize: t.font('h2'), fontWeight: t.weight.bold, color: t.colors.ink, letterSpacing: -0.4 },
    closeButton: { width: t.tap(44), height: t.tap(44), borderRadius: t.radius.md, backgroundColor: t.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
    modalContent: { padding: t.space.xl, paddingBottom: 60 },

    cameraFrame: { borderRadius: t.radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: t.colors.line, backgroundColor: '#000000', ...t.shadow('card') },
    cameraView: { width: '100%', height: 280 },
    cameraHint: { fontSize: t.font('bodySm'), fontWeight: t.weight.semibold, color: t.colors.white, textAlign: 'center', paddingVertical: t.space.md, backgroundColor: 'rgba(0,0,0,0.55)' },

    contactStrip: { backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.line, padding: t.space.lg, gap: t.space.md, ...t.shadow('soft') },
    contactStripUrgent: { borderColor: t.colors.dangerBorder, backgroundColor: t.colors.dangerTint },
    contactStripTitle: { fontSize: t.font('h3'), fontWeight: t.weight.bold, color: t.colors.ink, letterSpacing: -0.3 },
    contactRow: { flexDirection: 'row', alignItems: 'center', gap: t.space.md },
    contactAvatar: { width: t.tap(48), height: t.tap(48), borderRadius: 24, backgroundColor: t.colors.brandTint, alignItems: 'center', justifyContent: 'center' },
    contactName: { fontSize: t.font('bodySm'), fontWeight: t.weight.semibold, color: t.colors.ink },
    iconButton: { width: t.tap(48), height: t.tap(48), borderRadius: t.radius.md, backgroundColor: t.colors.brandTint, alignItems: 'center', justifyContent: 'center' },

    emptyState: { alignItems: 'center', gap: t.space.md, paddingVertical: t.space.xxxl, paddingHorizontal: t.space.lg },
    emptyIcon: { width: t.tap(72), height: t.tap(72), borderRadius: t.radius.lg, backgroundColor: t.colors.brandTint, alignItems: 'center', justifyContent: 'center' },

    activityRow: { flexDirection: 'row', alignItems: 'center', gap: t.space.md, backgroundColor: t.colors.surface, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.line, padding: t.space.md, ...t.shadow('soft') },
    activityIcon: { width: t.tap(46), height: t.tap(46), borderRadius: t.radius.sm, alignItems: 'center', justifyContent: 'center' },
    activityTitle: { fontSize: t.font('bodySm'), fontWeight: t.weight.semibold, color: t.colors.ink },
    activityDetail: { fontSize: t.font('label'), color: t.colors.inkSoft, lineHeight: t.lineHeight('label'), marginTop: 2 },
    activityMeta: { fontSize: t.font('tiny'), color: t.colors.muted, marginTop: 3, fontWeight: t.weight.medium },
    unreadDot: { width: 10, height: 10, borderRadius: 5 },

    weekCard: { backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.line, padding: t.space.lg, gap: t.space.md, ...t.shadow('soft') },
    weekTop: { flexDirection: 'row', alignItems: 'center', gap: t.space.md },
    weekBadge: { width: t.tap(44), height: t.tap(44), borderRadius: t.radius.sm, backgroundColor: t.colors.brandTint, alignItems: 'center', justifyContent: 'center' },
    weekBadgeText: { fontSize: t.font('body'), fontWeight: t.weight.bold, color: t.colors.brand },
    weekEyebrow: { fontSize: t.font('tiny'), fontWeight: t.weight.bold, color: t.colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
    weekTitle: { fontSize: t.font('h3'), fontWeight: t.weight.bold, color: t.colors.ink, letterSpacing: -0.3, marginTop: 1 },
    chevronOpen: { transform: [{ rotate: '180deg' }] },
    weekBody: { gap: t.space.md, paddingTop: t.space.md, borderTopWidth: 1, borderTopColor: t.colors.line },
    exampleBox: { backgroundColor: t.colors.surfaceMuted, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.line, padding: t.space.md, gap: 4 },
    quizPrompt: { fontSize: t.font('bodySm'), fontWeight: t.weight.semibold, color: t.colors.ink, lineHeight: t.lineHeight('bodySm') },
    quizOption: { flexDirection: 'row', alignItems: 'center', gap: t.space.sm, backgroundColor: t.colors.surface, borderRadius: t.radius.md, borderWidth: 1.5, borderColor: t.colors.line, padding: t.space.md, minHeight: t.tap(52) },
    quizCorrect: { borderColor: t.colors.low, backgroundColor: t.colors.lowTint },
    quizWrong: { borderColor: t.colors.danger, backgroundColor: t.colors.dangerTint },
    quizOptionText: { flex: 1, fontSize: t.font('bodySm'), fontWeight: t.weight.medium, color: t.colors.ink, lineHeight: t.lineHeight('bodySm') },
    quizFeedback: { borderRadius: t.radius.md, borderWidth: 1.5, padding: t.space.md, gap: 4 },
    quizFeedbackTitle: { fontSize: t.font('bodySm'), fontWeight: t.weight.bold },
    rememberText: {
      fontSize: t.font('bodySm'),
      lineHeight: t.lineHeight('bodySm'),
      color: t.colors.accent,
      fontWeight: t.weight.semibold,
      backgroundColor: t.colors.accentTint,
      borderRadius: t.radius.sm,
      padding: t.space.md,
    },
  });
}
