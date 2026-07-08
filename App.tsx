import { StatusBar } from 'expo-status-bar';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import * as SMS from 'expo-sms';
import {
  AlertTriangle,
  BookOpen,
  Camera,
  CheckCircle2,
  ChevronRight,
  Circle,
  CreditCard,
  ExternalLink,
  FileAudio,
  GraduationCap,
  Home,
  LifeBuoy,
  Link as LinkIcon,
  Mail,
  MessageCircle,
  Mic,
  Newspaper,
  Phone,
  PhoneCall,
  QrCode,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Trophy,
  Upload,
  Users,
  X,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  LogBox,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import type { DimensionValue, ImageStyle } from 'react-native';

import { emergencySteps, lessons, practiceExamples, recoverySteps, trustedContactMessage } from './src/data/content';
import { isAiReviewConfigured, reviewScamWithAi } from './src/services/aiScamReview';
import {
  isHfOcrConfigured,
  isHfTranscriptionConfigured,
  readScreenshotTextWithHuggingFace,
  transcribeAudioWithHuggingFace,
} from './src/services/huggingFaceMedia';
import { checkSpamWithHuggingFace, isHfSpamCheckConfigured } from './src/services/huggingFaceSpam';
import { fetchScamAlerts } from './src/services/news';
import {
  analyzeCallChecklist,
  analyzeMessage,
  analyzePayments,
  analyzePhoneNumber,
  analyzeUrl,
  analyzeVoiceClone,
  labelForLevel,
} from './src/services/scamAnalyzer';
import {
  addConfidenceEntry,
  loadConfidence,
  loadContacts,
  loadFamilyPhrase,
  saveContacts,
  saveFamilyPhrase,
} from './src/services/storage';
import { AiScamReview, AnalysisResult, ConfidenceEntry, HfSpamReview, RiskLevel, ScamAlert, TrustedContact } from './src/types/app';

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
  | 'voicemail';

type ToggleState = Record<string, boolean>;

function normalizeCheckInput(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

const initialCallAnswers: ToggleState = {
  money: false,
  secret: false,
  code: false,
  remote: false,
  threat: false,
  callerId: false,
};

const initialVoiceAnswers: ToggleState = {
  family: false,
  money: false,
  secret: false,
  emotional: false,
};

const initialPayments: ToggleState = {
  giftCard: false,
  crypto: false,
  wire: false,
  zelle: false,
  cashApp: false,
  venmo: false,
  bankCard: false,
};

const screenTitles: Record<Screen, string> = {
  home: 'Start',
  tools: 'Checks',
  scam: 'Message',
  call: 'Phone Call',
  emergency: 'Emergency',
  contacts: 'People to Call',
  link: 'Link',
  qr: 'QR Code',
  voice: 'Family Voice',
  payment: 'Before You Pay',
  news: 'Alerts',
  learn: 'Learn',
  practice: 'Quiz',
  recovery: 'Help After a Scam',
  phone: 'Phone Number',
  voicemail: 'Voicemail',
};

type ToolAction = { screen: Screen; label: string; detail: string; icon: LucideIcon; tone?: RiskLevel };

type LiveNotice = {
  id: string;
  title: string;
  body: string;
  label: string;
  screen: Screen;
  icon: LucideIcon;
  level: RiskLevel;
};

const liveNotices: LiveNotice[] = [
  {
    id: 'incoming-call',
    title: 'Incoming call',
    body: 'Unknown number. Ask: did they request money, secrecy, a code, or remote access?',
    label: 'Check call',
    screen: 'call',
    icon: PhoneCall,
    level: 'caution',
  },
  {
    id: 'new-message',
    title: 'New message',
    body: 'Prize, payment, and account messages should be checked before replying.',
    label: 'Check message',
    screen: 'scam',
    icon: MessageCircle,
    level: 'caution',
  },
  {
    id: 'unknown-email',
    title: 'Unknown email',
    body: 'Sender is unfamiliar. Check links, attachments, and requests before opening.',
    label: 'Check email',
    screen: 'scam',
    icon: Mail,
    level: 'high',
  },
  {
    id: 'likely-spam',
    title: 'Likely spam alert',
    body: 'Pressure, payment, or private information requests need a trusted second look.',
    label: 'Safety steps',
    screen: 'emergency',
    icon: ShieldAlert,
    level: 'stop',
  },
];

const toolGroups: Array<{ title: string; items: ToolAction[] }> = [
  {
    title: 'Before you reply',
    items: [
      { screen: 'scam', label: 'Message or email', detail: 'Paste the words', icon: ShieldCheck },
      { screen: 'call', label: 'Phone call', detail: 'Answer yes or no', icon: PhoneCall },
      { screen: 'voicemail', label: 'Voicemail', detail: 'Add notes from the call', icon: FileAudio },
    ],
  },
  {
    title: 'Before you open',
    items: [
      { screen: 'link', label: 'Link', detail: 'Check the address', icon: LinkIcon },
      { screen: 'qr', label: 'QR code', detail: 'Preview the destination', icon: QrCode },
      { screen: 'phone', label: 'Phone number', detail: 'Check before calling back', icon: Search },
    ],
  },
  {
    title: 'Money or family',
    items: [
      { screen: 'voice', label: 'Family voice', detail: 'Use your phrase', icon: Mic },
      { screen: 'payment', label: 'Before you pay', detail: 'Check the payment type', icon: CreditCard },
      { screen: 'recovery', label: 'Already clicked or paid', detail: 'Start here', icon: LifeBuoy, tone: 'high' },
    ],
  },
  {
    title: 'Keep learning',
    items: [
      { screen: 'practice', label: 'Quiz', detail: 'Practice with examples', icon: Trophy },
      { screen: 'news', label: 'Alerts', detail: 'Current scam patterns', icon: Newspaper },
    ],
  },
];

const homePrimaryActions: ToolAction[] = [
  { screen: 'scam', label: 'Message or email', detail: 'Paste the words.', icon: ShieldCheck },
  { screen: 'call', label: 'Phone call', detail: 'Answer yes or no.', icon: PhoneCall },
  { screen: 'contacts', label: 'Trusted person', detail: 'Call or text them.', icon: Users },
];

const openingSteps: Array<{ title: string; detail?: string }> = [
  {
    title: 'Stop',
  },
  {
    title: 'Check',
  },
  {
    title: 'Call someone',
  },
];

type AppTheme = {
  mode: 'light' | 'dark';
  statusBar: 'light' | 'dark';
  background: string;
  header: string;
  surface: string;
  surfaceRaised: string;
  surfaceSoft: string;
  text: string;
  textStrong: string;
  textMuted: string;
  textSubtle: string;
  placeholder: string;
  border: string;
  borderStrong: string;
  inputBorder: string;
  primary: string;
  primarySoft: string;
  primaryBorder: string;
  primaryText: string;
  inverseText: string;
  blue: string;
  blueSoft: string;
  danger: string;
  dangerStrong: string;
  dangerSoft: string;
  dangerBorder: string;
  dangerTextSoft: string;
  warning: string;
  warningSoft: string;
  cautionSoft: string;
  successSoft: string;
  successBorder: string;
  disabledSurface: string;
  disabledText: string;
  pressed: string;
  practice: string;
  selected: string;
  selectedBorder: string;
  cameraOverlay: string;
  shadow: string;
  switchOffTrack: string;
  switchOffThumb: string;
};

const lightTheme: AppTheme = {
  mode: 'light',
  statusBar: 'dark',
  background: '#F4F7F5',
  header: '#FEFFFE',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceSoft: '#F2F4F7',
  text: '#17212B',
  textStrong: '#17212B',
  textMuted: '#344054',
  textSubtle: '#667085',
  placeholder: '#8A94A6',
  border: '#E4E7EC',
  borderStrong: '#D0D5DD',
  inputBorder: '#D0D5DD',
  primary: '#0B6E69',
  primarySoft: '#EFF8F5',
  primaryBorder: '#BFE3DA',
  primaryText: '#FFFFFF',
  inverseText: '#FFFFFF',
  blue: '#245B8C',
  blueSoft: '#EDF6FB',
  danger: '#B42318',
  dangerStrong: '#B3261E',
  dangerSoft: '#FFF1F0',
  dangerBorder: '#FDA29B',
  dangerTextSoft: '#FFE9E7',
  warning: '#C2410C',
  warningSoft: '#FFF7ED',
  cautionSoft: '#FFFBEB',
  successSoft: '#EFF8F5',
  successBorder: '#5EEAD4',
  disabledSurface: '#F2F4F7',
  disabledText: '#98A2B3',
  pressed: '#F1F7F5',
  practice: '#183A4A',
  selected: '#EDF6FB',
  selectedBorder: '#9BC3DF',
  cameraOverlay: 'rgba(23,33,43,0.82)',
  shadow: '#344054',
  switchOffTrack: '#D8DFDA',
  switchOffThumb: '#F9FAFB',
};

const darkTheme: AppTheme = {
  mode: 'dark',
  statusBar: 'light',
  background: '#0D1418',
  header: '#111B20',
  surface: '#162128',
  surfaceRaised: '#1C2931',
  surfaceSoft: '#1A252B',
  text: '#F5FAF8',
  textStrong: '#FFFFFF',
  textMuted: '#D7E0DD',
  textSubtle: '#AEB9B6',
  placeholder: '#8C9B98',
  border: '#2A3940',
  borderStrong: '#3C4F56',
  inputBorder: '#3C4F56',
  primary: '#6FD6C9',
  primarySoft: '#12312F',
  primaryBorder: '#276C64',
  primaryText: '#071413',
  inverseText: '#FFFFFF',
  blue: '#8FBFE8',
  blueSoft: '#142739',
  danger: '#FF9A90',
  dangerStrong: '#FF776D',
  dangerSoft: '#351917',
  dangerBorder: '#7A332E',
  dangerTextSoft: '#FFE3DF',
  warning: '#F6B261',
  warningSoft: '#332416',
  cautionSoft: '#302A15',
  successSoft: '#12312F',
  successBorder: '#3CB6A7',
  disabledSurface: '#1A252B',
  disabledText: '#667573',
  pressed: '#1D2D33',
  practice: '#102E3A',
  selected: '#142E42',
  selectedBorder: '#3F7198',
  cameraOverlay: 'rgba(7,12,14,0.84)',
  shadow: '#000000',
  switchOffTrack: '#314248',
  switchOffThumb: '#AEB9B6',
};

type AppStyles = ReturnType<typeof createStyles>;

const DesignContext = React.createContext<{ styles: AppStyles; theme: AppTheme } | null>(null);

function useDesign() {
  const value = React.useContext(DesignContext);
  if (!value) throw new Error('Design context is missing.');
  return value;
}

function levelColor(theme: AppTheme, level: RiskLevel) {
  switch (level) {
    case 'stop':
      return theme.danger;
    case 'high':
      return theme.warning;
    case 'caution':
      return theme.warning;
    default:
      return theme.primary;
  }
}

function levelBackground(theme: AppTheme, level: RiskLevel) {
  switch (level) {
    case 'stop':
      return theme.dangerSoft;
    case 'high':
      return theme.warningSoft;
    case 'caution':
      return theme.cautionSoft;
    default:
      return theme.successSoft;
  }
}

function formatDate(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, '');
}

export default function App() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const scrollRef = useRef<ScrollView>(null);
  const screenAnim = useRef(new Animated.Value(1)).current;
  const noticeAnim = useRef(new Animated.Value(1)).current;
  const urgentPulse = useRef(new Animated.Value(0)).current;
  const [screen, setScreen] = useState<Screen>('home');
  const [liveNoticeIndex, setLiveNoticeIndex] = useState(0);
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [confidence, setConfidence] = useState<ConfidenceEntry[]>([]);
  const [familyPhrase, setFamilyPhrase] = useState('');
  const [alerts, setAlerts] = useState<ScamAlert[]>([]);
  const [messageText, setMessageText] = useState('');
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
  const lastHfSpamInput = useRef('');
  const lastHfSpamReview = useRef<HfSpamReview | null>(null);
  const currentHfSpamInput = useRef('');
  const [callAnswers, setCallAnswers] = useState<ToggleState>(initialCallAnswers);
  const [voiceAnswers, setVoiceAnswers] = useState<ToggleState>(initialVoiceAnswers);
  const [paymentAnswers, setPaymentAnswers] = useState<ToggleState>(initialPayments);
  const [urlText, setUrlText] = useState('');
  const [qrValue, setQrValue] = useState('');
  const [scanning, setScanning] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [contactDrafts, setContactDrafts] = useState<TrustedContact[]>([
    { id: 'contact-1', label: 'Trusted Contact 1', name: '', phone: '' },
    { id: 'contact-2', label: 'Trusted Contact 2', name: '', phone: '' },
  ]);
  const [lessonOpen, setLessonOpen] = useState<string | null>(lessons[0]?.id ?? null);
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
    screenAnim.setValue(0);
    Animated.timing(screenAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [screen, screenAnim]);

  useEffect(() => {
    noticeAnim.setValue(0);
    Animated.timing(noticeAnim, {
      toValue: 1,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [liveNoticeIndex, noticeAnim]);

  useEffect(() => {
    const noticeTimer = setInterval(() => {
      setLiveNoticeIndex((current) => (current + 1) % liveNotices.length);
    }, 5200);
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(urgentPulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(urgentPulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );

    pulse.start();

    return () => {
      clearInterval(noticeTimer);
      pulse.stop();
    };
  }, [urgentPulse]);

  const scamResult = useMemo(
    () => analyzeMessage([messageText, voicemailTranscript].filter(Boolean).join('\n'), 'message or transcript'),
    [messageText, voicemailTranscript],
  );
  const callResult = useMemo(() => analyzeCallChecklist(callAnswers), [callAnswers]);
  const voiceResult = useMemo(() => analyzeVoiceClone(voiceAnswers, familyPhrase), [voiceAnswers, familyPhrase]);
  const paymentResult = useMemo(() => analyzePayments(paymentAnswers), [paymentAnswers]);
  const linkResult = useMemo(() => analyzeUrl(urlText), [urlText]);
  const qrResult = useMemo(() => analyzeUrl(qrValue), [qrValue]);
  const phoneResult = useMemo(() => analyzePhoneNumber(phoneNumber), [phoneNumber]);
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

  useEffect(() => {
    currentHfSpamInput.current = normalizeCheckInput(hfSpamInputText);
  }, [hfSpamInputText]);

  function navigate(next: Screen) {
    if (next === screen) return;
    setScreen(next);
    if (next !== 'qr') setScanning(false);
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

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
      base64: true,
    });

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
    setAiReview(null);
    setAiReviewError('');
    setHfSpamReview(null);
    setHfSpamError('');
    setHfSpamNotice('');
    setOcrError('');
  }

  function updateVoicemailTranscript(value: string) {
    setVoicemailTranscript(value);
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

  async function runHfSpamCheck() {
    const input = hfSpamInputText.trim();
    const normalizedInput = normalizeCheckInput(input);

    if (!normalizedInput) {
      Alert.alert('Paste words first', 'This spam model checks pasted text, not screenshots.');
      return;
    }

    if (hfSpamRequestInFlight.current) {
      setHfSpamNotice('This message is already being checked.');
      return;
    }

    if (lastHfSpamInput.current === normalizedInput && lastHfSpamReview.current) {
      setHfSpamReview(lastHfSpamReview.current);
      setHfSpamError('');
      setHfSpamNotice('You already checked this message. Showing the saved result.');
      return;
    }

    hfSpamRequestInFlight.current = true;
    setHfSpamLoading(true);
    setHfSpamError('');
    setHfSpamNotice('');

    try {
      const review = await checkSpamWithHuggingFace(input);
      lastHfSpamInput.current = normalizedInput;
      lastHfSpamReview.current = review;

      if (currentHfSpamInput.current === normalizedInput) {
        setHfSpamReview(review);
      }
    } catch (error) {
      setHfSpamReview(null);
      setHfSpamError(error instanceof Error ? error.message : 'SMS spam check failed.');
    } finally {
      hfSpamRequestInFlight.current = false;
      setHfSpamLoading(false);
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
      const review = await reviewScamWithAi({
        messageText,
        transcript: voicemailTranscript,
        screenshotBase64,
        localResult: scamResult,
      });
      setAiReview(review);
    } catch (error) {
      setAiReview(null);
      setAiReviewError(error instanceof Error ? error.message : 'AI review failed.');
    } finally {
      setAiReviewLoading(false);
    }
  }

  async function pickVoicemail() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['audio/*', 'text/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });

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
      contactIndex === index
        ? {
            ...contact,
            name: contact.name.trim(),
            phone: contact.phone.trim(),
          }
        : contact,
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
      Linking.openURL(`sms:${phone}?body=${encodeURIComponent(trustedContactMessage)}`);
    }
  }

  async function choosePractice(choice: 'safe' | 'suspicious' | 'scam') {
    if (selectedPractice) return;

    setSelectedPractice(choice);
    const correct = choice === practice.answer ? practiceStats.correct + 1 : practiceStats.correct;
    const answered = practiceStats.answered + 1;
    setPracticeStats({ correct, answered });

    const nextScore = Math.round((correct / answered) * 100);
    setConfidence(await addConfidenceEntry(nextScore));
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
    const query = encodeURIComponent(`${phoneNumber} scam report`);
    Linking.openURL(`https://www.google.com/search?q=${query}`);
  }

  function renderHeader() {
    return (
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoMark}>
            <Shield size={30} color={theme.primaryText} strokeWidth={2.6} />
          </View>
          <View style={styles.brandText}>
            <Text style={styles.eyebrow}>Shield Our Elders</Text>
            <Text style={styles.title}>{screenTitles[screen]}</Text>
          </View>
        </View>
        <View style={styles.privacyPill}>
          <ShieldCheck size={18} color={theme.primary} />
          <Text style={styles.privacyText}>Check before replying</Text>
        </View>
      </View>
    );
  }

  function renderBottomNav() {
    const items: Array<{ screen: Screen; label: string; icon: LucideIcon }> = [
      { screen: 'home', label: 'Home', icon: Home },
      { screen: 'tools', label: 'Tools', icon: ShieldAlert },
      { screen: 'contacts', label: 'Contacts', icon: Users },
      { screen: 'learn', label: 'Learn', icon: BookOpen },
      { screen: 'recovery', label: 'Recover', icon: LifeBuoy },
    ];

    return (
      <View style={styles.bottomNav}>
        {items.map((item) => {
          const Icon = item.icon;
          const active = screen === item.screen;
          return (
            <TouchableOpacity key={item.screen} style={[styles.navItem, active && styles.navItemActive]} onPress={() => navigate(item.screen)} activeOpacity={0.75}>
              <Icon size={25} color={active ? theme.primary : theme.textSubtle} strokeWidth={active ? 2.7 : 2.2} />
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  function renderHome() {
    const liveNotice = liveNotices[liveNoticeIndex % liveNotices.length];

    return (
      <View style={styles.stack}>
        <View style={styles.homeHero}>
          <Text style={styles.homeHeroLabel}>Start here</Text>
          <Text style={styles.homeHeroTitle}>Stop first. Then check.</Text>
          <Text style={styles.homeHeroText}>Use one clear check before you reply, pay, or click.</Text>
          <View style={styles.briefStepRow}>
            {openingSteps.map((step) => (
              <View key={step.title} style={styles.briefStep}>
                <CheckCircle2 size={22} color={theme.primary} strokeWidth={2.7} />
                <Text style={styles.briefStepText}>{step.title}</Text>
              </View>
            ))}
          </View>
        </View>

        <LiveNoticeCard notice={liveNotice} progress={noticeAnim} pulse={urgentPulse} onPress={() => navigate(liveNotice.screen)} />

        <TouchableOpacity
          style={styles.emergencyButton}
          activeOpacity={0.88}
          onPress={() => {
            setEmergencyVisible(true);
            navigate('emergency');
          }}
        >
          <Siren size={42} color={theme.primaryText} strokeWidth={2.8} />
          <View style={styles.emergencyTextWrap}>
            <Text style={styles.emergencyTitle}>I THINK THIS IS A SCAM</Text>
            <Text style={styles.emergencySub}>Show safety steps</Text>
          </View>
          <ChevronRight size={34} color={theme.primaryText} />
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>What happened?</Text>
          <TouchableOpacity style={styles.textLinkButton} onPress={() => navigate('tools')}>
            <Text style={styles.inlineLink}>More</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.homeActionGroup}>
          {homePrimaryActions.map((tool, index) => (
            <HomeActionButton key={tool.screen} {...tool} last={index === homePrimaryActions.length - 1} onPress={() => navigate(tool.screen)} />
          ))}
        </View>
      </View>
    );
  }

  function renderTools() {
    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>Pick one check.</Text>
        {toolGroups.map((group) => (
          <View key={group.title} style={styles.toolSection}>
            <Text style={styles.toolSectionTitle}>{group.title}</Text>
            <View style={styles.toolListGroup}>
              {group.items.map((tool, index) => (
                <ToolButton key={tool.screen} {...tool} last={index === group.items.length - 1} onPress={() => navigate(tool.screen)} />
              ))}
            </View>
          </View>
        ))}
      </View>
    );
  }

  function renderScamCheck() {
    const aiReady = isAiReviewConfigured();
    const hfReady = isHfSpamCheckConfigured();
    const ocrReady = isHfOcrConfigured();
    const transcriptionReady = isHfTranscriptionConfigured();
    const showLocalFallback = hasScamInput && !hfReady;

    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>Paste the words. You can also add a screenshot.</Text>
        <TextInput
          style={styles.textArea}
          value={messageText}
          onChangeText={updateMessageText}
          multiline
          textAlignVertical="top"
          placeholder="Paste message here"
          placeholderTextColor={theme.placeholder}
        />
        <View style={styles.buttonRow}>
          <SecondaryAction icon={Upload} label="Add screenshot" onPress={pickScreenshot} />
          <SecondaryAction icon={FileAudio} label="Add file" onPress={pickVoicemail} />
          <SecondaryAction
            icon={X}
            label="Clear"
            onPress={clearMessageCheck}
            disabled={!messageText && !voicemailTranscript && !screenshotUri && !voicemailFile}
          />
        </View>
        {screenshotUri ? (
          <View style={styles.attachment}>
            <Image source={{ uri: screenshotUri }} style={styles.attachmentImage as ImageStyle} />
            <View style={styles.attachmentText}>
              <Text style={styles.attachmentTitle}>Screenshot attached</Text>
              <Text style={styles.smallMuted}>{screenshotBase64 ? 'Ready for AI review.' : 'Screenshot saved here.'}</Text>
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
            >
              <X size={26} color={theme.textSubtle} />
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
          placeholder="Optional: paste a voicemail transcript here."
          placeholderTextColor={theme.placeholder}
        />
        {screenshotBase64 ? (
          <View style={styles.aiActionBox}>
            <SecondaryAction
              icon={Search}
              label={ocrLoading ? 'Reading...' : 'Read screenshot'}
              onPress={runScreenshotOcr}
              disabled={ocrLoading || !ocrReady}
            />
            {!ocrReady ? <Text style={styles.smallMuted}>Screenshot reading is off. Add a Hugging Face key to turn it on.</Text> : null}
            {ocrError ? <Text style={styles.errorText}>{ocrError}</Text> : null}
          </View>
        ) : null}
        {ocrText ? <ExtractedTextPanel title="Text from screenshot" text={ocrText} /> : null}
        {voicemailUri ? (
          <View style={styles.aiActionBox}>
            <SecondaryAction
              icon={Mic}
              label={transcriptionLoading ? 'Transcribing...' : 'Transcribe file'}
              onPress={runAudioTranscription}
              disabled={transcriptionLoading || !transcriptionReady}
            />
            {!transcriptionReady ? <Text style={styles.smallMuted}>Audio transcription is off. Add a Hugging Face key to turn it on.</Text> : null}
            {transcriptionError ? <Text style={styles.errorText}>{transcriptionError}</Text> : null}
          </View>
        ) : null}
        <View style={styles.aiActionBox}>
          <SecondaryAction
            icon={ShieldAlert}
            label={hfSpamLoading ? 'Checking...' : 'SMS spam check'}
            onPress={runHfSpamCheck}
            disabled={!hasHfTextInput || hfSpamLoading || !hfReady}
          />
          {!hfReady && hasHfTextInput ? <Text style={styles.smallMuted}>SMS spam check is off. Add a Hugging Face key to turn it on.</Text> : null}
          {!hasHfTextInput && screenshotBase64 ? <Text style={styles.smallMuted}>The SMS model reads pasted words, not screenshots.</Text> : null}
          {hfSpamNotice ? <Text style={styles.smallMuted}>{hfSpamNotice}</Text> : null}
          {hfSpamError ? <Text style={styles.errorText}>{hfSpamError}</Text> : null}
        </View>
        {hfSpamReview ? <SpamModelPanel review={hfSpamReview} /> : null}
        {aiReady ? (
          <View style={styles.aiActionBox}>
          <SecondaryAction
            icon={ShieldCheck}
              label={aiReviewLoading ? 'Reading...' : 'Screenshot review'}
            onPress={runAiReview}
              disabled={!screenshotBase64 || aiReviewLoading || !aiReady}
          />
            {!aiReady && screenshotBase64 ? <Text style={styles.smallMuted}>Screenshot reading is off. Paste the visible words to check them.</Text> : null}
          {aiReviewError ? <Text style={styles.errorText}>{aiReviewError}</Text> : null}
        </View>
        ) : null}
        {aiReview ? <AiReviewPanel review={aiReview} /> : null}
        {showLocalFallback ? <RiskPanel result={scamResult} /> : null}
      </View>
    );
  }

  function renderCallCheck() {
    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>Answer yes or no.</Text>
        <ToggleRow label="Asked for money?" value={callAnswers.money} onValueChange={(value) => setCallAnswers({ ...callAnswers, money: value })} />
        <ToggleRow label="Said not to tell anyone?" value={callAnswers.secret} onValueChange={(value) => setCallAnswers({ ...callAnswers, secret: value })} />
        <ToggleRow label="Asked for a code?" value={callAnswers.code} onValueChange={(value) => setCallAnswers({ ...callAnswers, code: value })} />
        <ToggleRow label="Asked to control your device?" value={callAnswers.remote} onValueChange={(value) => setCallAnswers({ ...callAnswers, remote: value })} />
        <ToggleRow label="Threatened arrest or account closing?" value={callAnswers.threat} onValueChange={(value) => setCallAnswers({ ...callAnswers, threat: value })} />
        <ToggleRow label="Trusting caller ID only?" value={callAnswers.callerId} onValueChange={(value) => setCallAnswers({ ...callAnswers, callerId: value })} />
        <SecondaryAction icon={X} label="Clear answers" onPress={() => setCallAnswers(initialCallAnswers)} disabled={!hasCallAnswers} />
        {hasCallAnswers ? <RiskPanel result={callResult} /> : null}
        <TrustedContactStrip contacts={contacts} onCall={callContact} onText={textContact} />
      </View>
    );
  }

  function renderEmergency() {
    return (
      <View style={styles.stack}>
        <View style={styles.stopPanel}>
          <Siren size={48} color={theme.danger} strokeWidth={2.8} />
          <Text style={styles.stopTitle}>Stop. You have time.</Text>
          <Text style={styles.stopText}>A real bank, agency, or family member can wait.</Text>
        </View>
        {emergencySteps.map((step, index) => (
          <View key={step} style={styles.stepRow}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{index + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
        <TrustedContactStrip contacts={contacts} onCall={callContact} onText={textContact} urgent />
        <TouchableOpacity style={styles.primaryButton} onPress={() => Linking.openURL('https://reportfraud.ftc.gov/')}>
          <ExternalLink size={24} color={theme.primaryText} />
          <Text style={styles.primaryButtonText}>Open ReportFraud.ftc.gov</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderContacts() {
    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>Save up to two people you trust.</Text>
        {contactDrafts.map((contact, index) => (
          <View style={styles.card} key={contact.id}>
            <Text style={styles.cardTitle}>{contact.label}</Text>
            <TextInput
              style={styles.input}
              value={contact.name}
              onChangeText={(value) =>
                setContactDrafts((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, name: value } : item)))
              }
              placeholder={index === 0 ? 'Daughter, son, caregiver, friend' : 'Backup contact'}
              placeholderTextColor={theme.placeholder}
            />
            <TextInput
              style={styles.input}
              value={contact.phone}
              onChangeText={(value) =>
                setContactDrafts((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, phone: value } : item)))
              }
              keyboardType="phone-pad"
              placeholder="Phone number"
              placeholderTextColor={theme.placeholder}
            />
            <View style={styles.buttonRow}>
              <SecondaryAction icon={CheckCircle2} label="Save" onPress={() => saveContactDraft(index)} />
              <SecondaryAction icon={Phone} label="Call" onPress={() => callContact(contact)} disabled={!contact.phone.trim()} />
              <SecondaryAction icon={MessageCircle} label="Text" onPress={() => textContact(contact)} disabled={!contact.phone.trim()} />
            </View>
          </View>
        ))}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Family Verification Phrase</Text>
          <Text style={styles.cardBody}>Use this for family emergency calls. Keep it private.</Text>
          <TextInput
            style={styles.input}
            value={familyPhrase}
            onChangeText={setFamilyPhrase}
            placeholder="Example: blue porch light"
            placeholderTextColor={theme.placeholder}
          />
          <TouchableOpacity style={styles.primaryButton} onPress={savePhrase}>
            <ShieldCheck size={24} color={theme.primaryText} />
            <Text style={styles.primaryButtonText}>Save phrase</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderLinkCheck() {
    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>Paste a link before opening it.</Text>
        <TextInput
          style={styles.input}
          value={urlText}
          onChangeText={setUrlText}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://example.com"
          placeholderTextColor={theme.placeholder}
        />
        {hasUrlInput ? <RiskPanel result={linkResult} /> : null}
        <SecondaryAction icon={X} label="Clear" onPress={() => setUrlText('')} disabled={!hasUrlInput} />
        <TouchableOpacity
          style={[styles.secondaryButtonWide, !hasUrlInput && styles.disabledButton]}
          onPress={() => openUrl(urlText)}
          disabled={!hasUrlInput}
        >
          <ExternalLink size={24} color={hasUrlInput ? theme.primary : theme.disabledText} />
          <Text style={[styles.secondaryButtonWideText, !hasUrlInput && styles.disabledText]}>Open only if expected</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderQrCheck() {
    const canScan = cameraPermission?.granted;

    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>Scan first. Open only after checking.</Text>
        {!canScan ? (
          <TouchableOpacity style={styles.primaryButton} onPress={requestCameraPermission}>
            <Camera size={24} color={theme.primaryText} />
          <Text style={styles.primaryButtonText}>Allow camera for QR scan</Text>
          </TouchableOpacity>
        ) : null}
        {canScan && scanning ? (
          <View style={styles.cameraFrame}>
            <CameraView
              style={styles.cameraView}
              facing="back"
              onBarcodeScanned={onQrScanned}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            />
            <Text style={styles.cameraHint}>Point at a QR code</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.primaryButton} onPress={() => setScanning(true)} disabled={!canScan}>
            <QrCode size={24} color={theme.primaryText} />
            <Text style={styles.primaryButtonText}>{qrValue ? 'Scan another QR code' : 'Start QR scan'}</Text>
          </TouchableOpacity>
        )}
        <TextInput
          style={styles.input}
          value={qrValue}
          onChangeText={setQrValue}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="QR destination appears here"
          placeholderTextColor={theme.placeholder}
        />
        {hasQrInput ? <RiskPanel result={qrResult} /> : null}
        <SecondaryAction icon={X} label="Clear" onPress={() => setQrValue('')} disabled={!hasQrInput} />
        <TouchableOpacity
          style={[styles.secondaryButtonWide, !hasQrInput && styles.disabledButton]}
          onPress={() => openUrl(qrValue)}
          disabled={!hasQrInput}
        >
          <ExternalLink size={24} color={hasQrInput ? theme.primary : theme.disabledText} />
          <Text style={[styles.secondaryButtonWideText, !hasQrInput && styles.disabledText]}>Open only if verified</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderVoiceClone() {
    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>Use this when a caller sounds like family.</Text>
        <ToggleRow label="Says they are family?" value={voiceAnswers.family} onValueChange={(value) => setVoiceAnswers({ ...voiceAnswers, family: value })} />
        <ToggleRow label="Needs money now?" value={voiceAnswers.money} onValueChange={(value) => setVoiceAnswers({ ...voiceAnswers, money: value })} />
        <ToggleRow label="Says keep it secret?" value={voiceAnswers.secret} onValueChange={(value) => setVoiceAnswers({ ...voiceAnswers, secret: value })} />
        <ToggleRow label="Story feels shocking?" value={voiceAnswers.emotional} onValueChange={(value) => setVoiceAnswers({ ...voiceAnswers, emotional: value })} />
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Verification phrase</Text>
          <TextInput
            style={styles.input}
            value={familyPhrase}
            onChangeText={setFamilyPhrase}
            placeholder="Private family phrase"
            placeholderTextColor={theme.placeholder}
          />
          <SecondaryAction icon={ShieldCheck} label="Save phrase" onPress={savePhrase} />
        </View>
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
          <ToggleRow key={key} label={label} value={paymentAnswers[key]} onValueChange={(value) => setPaymentAnswers({ ...paymentAnswers, [key]: value })} />
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
          <TouchableOpacity style={styles.refreshButton} onPress={refreshAlerts}>
            <Newspaper size={22} color={theme.primary} />
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
    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>Short lessons. Open one at a time.</Text>
        {lessons.map((lesson) => {
          const open = lessonOpen === lesson.id;
          return (
            <TouchableOpacity key={lesson.id} style={styles.lessonItem} onPress={() => setLessonOpen(open ? null : lesson.id)} activeOpacity={0.78}>
              <View style={styles.lessonHeader}>
                <View>
                  <Text style={styles.lessonTitle}>{lesson.title}</Text>
                  <Text style={styles.smallMuted}>{lesson.minutes} minute lesson</Text>
                </View>
                <GraduationCap size={30} color={theme.blue} />
              </View>
              <Text style={styles.cardBody}>{lesson.summary}</Text>
              {open ? (
                <View style={styles.lessonBody}>
                  {lesson.steps.map((step) => (
                    <View key={step} style={styles.bulletRow}>
                      <CheckCircle2 size={23} color={theme.primary} />
                      <Text style={styles.bulletText}>{step}</Text>
                    </View>
                  ))}
                  <Text style={styles.rememberText}>{lesson.remember}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigate('practice')}>
          <Trophy size={24} color={theme.primaryText} />
          <Text style={styles.primaryButtonText}>Start practice</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderPractice() {
    const options: Array<'safe' | 'suspicious' | 'scam'> = ['safe', 'suspicious', 'scam'];
    const answered = selectedPractice !== null;

    return (
      <View style={styles.stack}>
        <View style={styles.confidencePanel}>
          <View style={styles.metricTopRow}>
            <Text style={styles.metricLabel}>Question {practiceNumber} of {practiceExamples.length}</Text>
            <Text style={styles.metricSmall}>
              {practiceStats.answered ? `${practiceStats.correct}/${practiceStats.answered} correct` : storedConfidence ? 'Last score' : 'Start quiz'}
            </Text>
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
                  <CheckCircle2 size={25} color={theme.primary} />
                ) : isWrong ? (
                  <X size={25} color={theme.danger} />
                ) : (
                  <Circle size={25} color={isSelected ? theme.blue : theme.textSubtle} />
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
                <AlertTriangle size={22} color={theme.warning} />
                <Text style={styles.bulletText}>{flag}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.primaryButton} onPress={nextPractice}>
              <ChevronRight size={24} color={theme.primaryText} />
              <Text style={styles.primaryButtonText}>Next example</Text>
            </TouchableOpacity>
            <SecondaryAction icon={X} label="Restart quiz" onPress={restartPractice} />
          </View>
        ) : null}
      </View>
    );
  }

  function renderRecovery() {
    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>If anything was shared or paid, start here.</Text>
        {recoverySteps.map((group) => (
          <View key={group.title} style={styles.card}>
            <Text style={styles.cardTitle}>{group.title}</Text>
            {group.items.map((item) => (
              <View key={item} style={styles.bulletRow}>
                <CheckCircle2 size={23} color={theme.primary} />
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </View>
        ))}
        <TouchableOpacity style={styles.primaryButton} onPress={() => Linking.openURL('https://reportfraud.ftc.gov/')}>
          <ExternalLink size={24} color={theme.primaryText} />
          <Text style={styles.primaryButtonText}>Report fraud to FTC</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButtonWide} onPress={() => Linking.openURL('https://www.ic3.gov/')}>
          <ExternalLink size={24} color={theme.primary} />
          <Text style={styles.secondaryButtonWideText}>Report internet fraud to IC3</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderPhoneLookup() {
    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>Paste a number. Unknown numbers still need checking.</Text>
        <TextInput
          style={styles.input}
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
          placeholder="Phone number"
          placeholderTextColor={theme.placeholder}
        />
        {hasPhoneInput ? <RiskPanel result={phoneResult} /> : null}
        <SecondaryAction icon={X} label="Clear" onPress={() => setPhoneNumber('')} disabled={!hasPhoneInput} />
        <TouchableOpacity
          style={[styles.secondaryButtonWide, !hasPhoneInput && styles.disabledButton]}
          onPress={openSearchForPhone}
          disabled={!hasPhoneInput}
        >
          <Search size={24} color={hasPhoneInput ? theme.primary : theme.disabledText} />
          <Text style={[styles.secondaryButtonWideText, !hasPhoneInput && styles.disabledText]}>Search public scam reports</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderVoicemail() {
    const voicemailResult = analyzeMessage(voicemailTranscript, 'voicemail transcript');
    const transcriptionReady = isHfTranscriptionConfigured();
    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>Upload a voicemail. The app can transcribe it.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={pickVoicemail}>
          <FileAudio size={24} color={theme.primaryText} />
          <Text style={styles.primaryButtonText}>Upload voicemail</Text>
        </TouchableOpacity>
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
            <SecondaryAction
              icon={Mic}
              label={transcriptionLoading ? 'Transcribing...' : 'Transcribe file'}
              onPress={runAudioTranscription}
              disabled={transcriptionLoading || !transcriptionReady}
            />
            {!transcriptionReady ? <Text style={styles.smallMuted}>Audio transcription is off. Add a Hugging Face key to turn it on.</Text> : null}
            {transcriptionError ? <Text style={styles.errorText}>{transcriptionError}</Text> : null}
          </View>
        ) : null}
        <TextInput
          style={styles.textArea}
          value={voicemailTranscript}
          onChangeText={updateVoicemailTranscript}
          multiline
          textAlignVertical="top"
          placeholder="Paste voicemail transcript here."
          placeholderTextColor={theme.placeholder}
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
      case 'practice':
        return renderPractice();
      case 'recovery':
        return renderRecovery();
      case 'phone':
        return renderPhoneLookup();
      case 'voicemail':
        return renderVoicemail();
      default:
        return renderHome();
    }
  }

  return (
    <DesignContext.Provider value={{ styles, theme }}>
      <KeyboardAvoidingView style={styles.app} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <StatusBar style={theme.statusBar} />
        {renderHeader()}
        <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Animated.View
            style={[
              styles.screenTransition,
              {
                opacity: screenAnim,
                transform: [
                  {
                    translateY: screenAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {screen !== 'home' ? (
              <TouchableOpacity style={styles.backButton} onPress={() => navigate('home')}>
                <ChevronRight size={22} color={theme.primary} style={styles.backIcon} />
                <Text style={styles.backText}>Home</Text>
              </TouchableOpacity>
            ) : null}
            {renderScreen()}
          </Animated.View>
        </ScrollView>
        {renderBottomNav()}
        <Modal visible={emergencyVisible && screen === 'emergency'} animationType="slide" onRequestClose={() => setEmergencyVisible(false)}>
          <View style={styles.modalScreen}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Scam Safety Steps</Text>
              <Pressable style={styles.closeButton} onPress={() => setEmergencyVisible(false)}>
                <X size={28} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent}>{renderEmergency()}</ScrollView>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </DesignContext.Provider>
  );
}

function HomeActionButton({
  label,
  detail,
  icon: Icon,
  onPress,
  tone,
  last,
}: {
  label: string;
  detail: string;
  icon: LucideIcon;
  onPress: () => void;
  tone?: RiskLevel;
  last?: boolean;
}) {
  const { styles, theme } = useDesign();
  const color = tone ? levelColor(theme, tone) : theme.primary;
  return (
    <Pressable style={({ pressed }) => [styles.homeActionButton, !last && styles.homeActionDivider, pressed && styles.pressedRow]} onPress={onPress}>
      <View style={[styles.homeActionIcon, { backgroundColor: tone ? levelBackground(theme, tone) : theme.primarySoft }]}>
        <Icon size={34} color={color} strokeWidth={2.6} />
      </View>
      <View style={styles.homeActionText}>
        <Text style={styles.homeActionTitle}>{label}</Text>
        <Text style={styles.homeActionDetail}>{detail}</Text>
      </View>
      <ChevronRight size={32} color={color} strokeWidth={2.7} />
    </Pressable>
  );
}

function ToolButton({
  label,
  detail,
  icon: Icon,
  onPress,
  tone,
  last,
}: {
  screen?: Screen;
  label: string;
  detail: string;
  icon: LucideIcon;
  onPress: () => void;
  tone?: RiskLevel;
  last?: boolean;
}) {
  const { styles, theme } = useDesign();
  const color = tone ? levelColor(theme, tone) : theme.primary;
  return (
    <Pressable style={({ pressed }) => [styles.toolButton, !last && styles.homeActionDivider, pressed && styles.pressedRow]} onPress={onPress}>
      <View style={[styles.toolIcon, { backgroundColor: tone ? levelBackground(theme, tone) : theme.primarySoft }]}>
        <Icon size={32} color={color} strokeWidth={2.5} />
      </View>
      <View style={styles.toolText}>
        <Text style={styles.toolTitle}>{label}</Text>
        <Text style={styles.toolDetail}>{detail}</Text>
      </View>
      <ChevronRight size={30} color={color} strokeWidth={2.6} />
    </Pressable>
  );
}

function LiveNoticeCard({
  notice,
  progress,
  pulse,
  onPress,
}: {
  notice: LiveNotice;
  progress: Animated.Value;
  pulse: Animated.Value;
  onPress: () => void;
}) {
  const { styles, theme } = useDesign();
  const Icon = notice.icon;
  const color = levelColor(theme, notice.level);
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-12, 0],
  });
  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, notice.level === 'stop' ? 1.07 : 1],
  });

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.liveNoticePressed]}>
      <Animated.View style={[styles.liveNotice, { opacity: progress, transform: [{ translateY }] }]}>
        <View style={styles.liveNoticeTop}>
          <Text style={styles.liveNoticeKicker}>Live protection</Text>
          <View style={[styles.liveNoticeBadge, { borderColor: color }]}>
            <Text style={[styles.liveNoticeBadgeText, { color }]}>{notice.label}</Text>
          </View>
        </View>
        <View style={styles.liveNoticeContent}>
          <Animated.View
            style={[
              styles.liveNoticeIcon,
              {
                backgroundColor: levelBackground(theme, notice.level),
                transform: [{ scale: pulseScale }],
              },
            ]}
          >
            <Icon size={31} color={color} strokeWidth={2.65} />
          </Animated.View>
          <View style={styles.liveNoticeText}>
            <Text style={styles.liveNoticeTitle}>{notice.title}</Text>
            <Text style={styles.liveNoticeBody}>{notice.body}</Text>
          </View>
          <ChevronRight size={30} color={color} strokeWidth={2.6} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

function ExtractedTextPanel({ title, text }: { title: string; text: string }) {
  const { styles } = useDesign();
  return (
    <View style={styles.scriptBox}>
      <Text style={styles.scriptLabel}>{title}</Text>
      <Text style={styles.scriptText}>{text}</Text>
    </View>
  );
}

function SpamModelPanel({ review }: { review: HfSpamReview }) {
  const { styles, theme } = useDesign();
  const color = levelColor(theme, review.level);

  return (
    <View style={[styles.aiPanel, { backgroundColor: levelBackground(theme, review.level), borderColor: color }]}>
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
          <AlertTriangle size={22} color={color} />
          <Text style={styles.bulletText}>{reason}</Text>
        </View>
      ))}
      <Text style={styles.nextTitle}>Do next</Text>
      {review.nextSteps.map((step) => (
        <View key={step} style={styles.bulletRow}>
          <CheckCircle2 size={23} color={theme.primary} />
          <Text style={styles.bulletText}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

function AiReviewPanel({ review }: { review: AiScamReview }) {
  const { styles, theme } = useDesign();
  const color = levelColor(theme, review.level);

  return (
    <View style={[styles.aiPanel, { backgroundColor: levelBackground(theme, review.level), borderColor: color }]}>
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
          <AlertTriangle size={22} color={color} />
          <Text style={styles.bulletText}>{reason}</Text>
        </View>
      ))}
      <Text style={styles.nextTitle}>Do next</Text>
      {review.nextSteps.map((step) => (
        <View key={step} style={styles.bulletRow}>
          <CheckCircle2 size={23} color={theme.primary} />
          <Text style={styles.bulletText}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

function RiskPanel({ result }: { result: AnalysisResult }) {
  const { styles, theme } = useDesign();
  const color = levelColor(theme, result.level);
  const visibleFindings = [...result.findings].sort((left, right) => right.points - left.points).slice(0, 3);
  const hiddenFindingCount = Math.max(0, result.findings.length - visibleFindings.length);
  return (
    <View style={[styles.riskPanel, { backgroundColor: levelBackground(theme, result.level), borderColor: color }]}>
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
              <AlertTriangle size={23} color={levelColor(theme, finding.severity)} />
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
          <CheckCircle2 size={23} color={theme.primary} />
          <Text style={styles.bulletText}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

function ToggleRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  const { styles, theme } = useDesign();
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.switchOffTrack, true: theme.primaryBorder }}
        thumbColor={value ? theme.primary : theme.switchOffThumb}
      />
    </View>
  );
}

function SecondaryAction({
  icon: Icon,
  label,
  onPress,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { styles, theme } = useDesign();
  return (
    <TouchableOpacity style={[styles.secondaryAction, disabled && styles.disabledButton]} onPress={onPress} disabled={disabled} activeOpacity={0.75}>
      <Icon size={23} color={disabled ? theme.disabledText : theme.primary} />
      <Text style={[styles.secondaryActionText, disabled && styles.disabledText]}>{label}</Text>
    </TouchableOpacity>
  );
}

function AttachmentLabel({ icon: Icon, label, onClear }: { icon: LucideIcon; label: string; onClear: () => void }) {
  const { styles, theme } = useDesign();
  return (
    <View style={styles.attachment}>
      <View style={styles.toolIcon}>
        <Icon size={26} color={theme.primary} />
      </View>
      <View style={styles.attachmentText}>
        <Text style={styles.attachmentTitle}>{label}</Text>
        <Text style={styles.smallMuted}>Attached on this device</Text>
      </View>
      <TouchableOpacity onPress={onClear}>
        <X size={26} color={theme.textSubtle} />
      </TouchableOpacity>
    </View>
  );
}

function ProgressBar({ value }: { value: number }) {
  const { styles } = useDesign();
  const width = `${Math.max(6, Math.min(100, value))}%` as DimensionValue;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width }]} />
    </View>
  );
}

function TrustedContactStrip({
  contacts,
  onCall,
  onText,
  urgent,
}: {
  contacts: TrustedContact[];
  onCall: (contact: TrustedContact) => void;
  onText: (contact: TrustedContact) => void;
  urgent?: boolean;
}) {
  const { styles, theme } = useDesign();
  return (
    <View style={[styles.contactStrip, urgent && styles.contactStripUrgent]}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Trusted Contact</Text>
        {!contacts.length ? <Text style={styles.smallMuted}>None saved</Text> : null}
      </View>
      {contacts.length ? (
        contacts.map((contact) => (
          <View key={contact.id} style={styles.contactRow}>
            <View style={styles.contactAvatar}>
              <Users size={26} color={theme.primary} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{contact.name || contact.label}</Text>
              <Text style={styles.smallMuted}>{contact.phone}</Text>
            </View>
            <TouchableOpacity style={styles.iconButton} onPress={() => onCall(contact)}>
              <Phone size={25} color={theme.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => onText(contact)}>
              <MessageCircle size={25} color={theme.primary} />
            </TouchableOpacity>
          </View>
        ))
      ) : (
        <Text style={styles.cardBody}>Add a daughter, son, caregiver, friend, or neighbor so help is one tap away.</Text>
      )}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    paddingTop: 52,
    paddingHorizontal: 22,
    paddingBottom: 16,
    backgroundColor: theme.header,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  logoMark: {
    width: 54,
    height: 54,
    borderRadius: 8,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    flex: 1,
  },
  eyebrow: {
    color: theme.blue,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  title: {
    color: theme.text,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  privacyPill: {
    marginTop: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.primarySoft,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
  },
  privacyText: {
    color: theme.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 142,
  },
  screenTransition: {
    flex: 1,
  },
  stack: {
    gap: 18,
  },
  backButton: {
    minHeight: 48,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingRight: 14,
    marginBottom: 8,
  },
  backIcon: {
    transform: [{ rotate: '180deg' }],
  },
  backText: {
    color: theme.primary,
    fontSize: 18,
    fontWeight: '900',
  },
  homeHero: {
    paddingTop: 4,
    paddingBottom: 4,
    gap: 12,
  },
  homeHeroLabel: {
    color: theme.primary,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  homeHeroTitle: {
    color: theme.text,
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '900',
  },
  homeHeroText: {
    color: theme.textMuted,
    fontSize: 21,
    lineHeight: 31,
    fontWeight: '700',
  },
  briefStepRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  briefStep: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: theme.primarySoft,
  },
  briefStepText: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '900',
  },
  liveNotice: {
    backgroundColor: theme.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 18,
    gap: 14,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  liveNoticePressed: {
    transform: [{ scale: 0.995 }],
  },
  liveNoticeTop: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  liveNoticeKicker: {
    color: theme.blue,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  liveNoticeBadge: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    backgroundColor: theme.surface,
  },
  liveNoticeBadgeText: {
    fontSize: 14,
    fontWeight: '900',
  },
  liveNoticeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  liveNoticeIcon: {
    width: 62,
    height: 62,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveNoticeText: {
    flex: 1,
  },
  liveNoticeTitle: {
    color: theme.text,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '900',
  },
  liveNoticeBody: {
    marginTop: 3,
    color: theme.textMuted,
    fontSize: 18,
    lineHeight: 27,
    fontWeight: '700',
  },
  emergencyButton: {
    minHeight: 122,
    backgroundColor: theme.dangerStrong,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  },
  emergencyTextWrap: {
    flex: 1,
  },
  emergencyTitle: {
    color: theme.primaryText,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 31,
  },
  emergencySub: {
    marginTop: 4,
    color: theme.dangerTextSoft,
    fontSize: 19,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 27,
    fontWeight: '900',
  },
  textLinkButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  inlineLink: {
    color: theme.primary,
    fontSize: 18,
    fontWeight: '900',
  },
  actionList: {
    gap: 12,
  },
  homeActionGroup: {
    backgroundColor: theme.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 1,
  },
  toolListGroup: {
    backgroundColor: theme.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 1,
  },
  toolSection: {
    gap: 8,
  },
  toolSectionTitle: {
    color: theme.textMuted,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '900',
  },
  homeActionButton: {
    minHeight: 100,
    backgroundColor: theme.surface,
    paddingHorizontal: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  homeActionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  pressedRow: {
    backgroundColor: theme.pressed,
    transform: [{ scale: 0.995 }],
  },
  homeActionIcon: {
    width: 64,
    height: 64,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeActionText: {
    flex: 1,
  },
  homeActionTitle: {
    color: theme.text,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '900',
  },
  homeActionDetail: {
    marginTop: 4,
    color: theme.textMuted,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '700',
  },
  toolButton: {
    minHeight: 102,
    backgroundColor: theme.surface,
    paddingHorizontal: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  toolIcon: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: theme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolText: {
    flex: 1,
  },
  toolTitle: {
    color: theme.text,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '900',
  },
  toolDetail: {
    marginTop: 3,
    color: theme.textSubtle,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '700',
  },
  metricLabel: {
    color: theme.textSubtle,
    fontSize: 16,
    fontWeight: '800',
  },
  metricTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  metricSmall: {
    color: theme.textMuted,
    fontSize: 15,
    fontWeight: '900',
  },
  metricValue: {
    color: theme.text,
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.primary,
  },
  contactStrip: {
    backgroundColor: theme.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    gap: 12,
  },
  contactStripUrgent: {
    borderColor: theme.dangerBorder,
    backgroundColor: theme.dangerSoft,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 74,
  },
  contactAvatar: {
    width: 52,
    height: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primarySoft,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    color: theme.text,
    fontSize: 19,
    fontWeight: '900',
  },
  iconButton: {
    width: 58,
    height: 58,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primarySoft,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
  },
  screenIntro: {
    color: theme.textMuted,
    fontSize: 21,
    lineHeight: 31,
    fontWeight: '700',
  },
  screenIntroNarrow: {
    flex: 1,
    color: theme.textMuted,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
  },
  textArea: {
    minHeight: 184,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.inputBorder,
    backgroundColor: theme.surface,
    padding: 16,
    color: theme.text,
    fontSize: 20,
    lineHeight: 30,
    fontWeight: '600',
  },
  textAreaSmall: {
    minHeight: 124,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.inputBorder,
    backgroundColor: theme.surface,
    padding: 16,
    color: theme.text,
    fontSize: 20,
    lineHeight: 29,
    fontWeight: '600',
  },
  input: {
    minHeight: 68,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.inputBorder,
    backgroundColor: theme.surface,
    paddingHorizontal: 16,
    color: theme.text,
    fontSize: 20,
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  secondaryAction: {
    minHeight: 60,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
    backgroundColor: theme.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  secondaryActionText: {
    color: theme.primary,
    fontSize: 18,
    fontWeight: '900',
  },
  secondaryButtonWide: {
    minHeight: 68,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
    backgroundColor: theme.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonWideText: {
    color: theme.primary,
    fontSize: 18,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.45,
  },
  disabledText: {
    color: theme.disabledText,
  },
  primaryButton: {
    minHeight: 70,
    borderRadius: 8,
    paddingHorizontal: 16,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  primaryButtonText: {
    color: theme.primaryText,
    fontSize: 20,
    fontWeight: '900',
  },
  attachment: {
    backgroundColor: theme.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  attachmentImage: {
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: theme.disabledSurface,
  },
  attachmentText: {
    flex: 1,
  },
  attachmentTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '900',
  },
  smallMuted: {
    color: theme.textSubtle,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  riskPanel: {
    borderRadius: 8,
    borderWidth: 1.5,
    padding: 18,
    gap: 14,
  },
  aiPanel: {
    borderRadius: 8,
    borderWidth: 1.5,
    padding: 18,
    gap: 14,
  },
  aiActionBox: {
    gap: 8,
  },
  errorText: {
    color: theme.danger,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '800',
  },
  riskTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  riskTextColumn: {
    flex: 1,
  },
  riskLabel: {
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  riskHeadline: {
    marginTop: 3,
    color: theme.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    maxWidth: 300,
  },
  scoreBadge: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
  },
  scoreText: {
    fontSize: 26,
    fontWeight: '900',
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    gap: 14,
  },
  cardTitle: {
    color: theme.text,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '900',
  },
  cardBody: {
    color: theme.textMuted,
    fontSize: 18,
    lineHeight: 27,
    fontWeight: '700',
  },
  findings: {
    gap: 10,
  },
  findingRow: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
    backgroundColor: theme.surface,
    borderRadius: 8,
    padding: 12,
  },
  findingText: {
    flex: 1,
  },
  findingTitle: {
    color: theme.text,
    fontSize: 19,
    fontWeight: '900',
  },
  findingDetail: {
    marginTop: 3,
    color: theme.textMuted,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '700',
  },
  scriptBox: {
    backgroundColor: theme.surface,
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  scriptLabel: {
    color: theme.blue,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  scriptText: {
    marginTop: 5,
    color: theme.text,
    fontSize: 19,
    lineHeight: 27,
    fontWeight: '800',
  },
  nextTitle: {
    color: theme.text,
    fontSize: 20,
    fontWeight: '900',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletText: {
    flex: 1,
    color: theme.textMuted,
    fontSize: 18,
    lineHeight: 27,
    fontWeight: '700',
  },
  toggleRow: {
    minHeight: 84,
    backgroundColor: theme.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  toggleLabel: {
    flex: 1,
    color: theme.text,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '800',
  },
  stopPanel: {
    backgroundColor: theme.dangerSoft,
    borderColor: theme.dangerBorder,
    borderWidth: 1,
    borderRadius: 8,
    padding: 18,
    gap: 10,
  },
  stopTitle: {
    color: theme.danger,
    fontSize: 31,
    lineHeight: 37,
    fontWeight: '900',
  },
  stopText: {
    color: theme.textMuted,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '700',
  },
  stepRow: {
    minHeight: 70,
    backgroundColor: theme.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNumber: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.danger,
  },
  stepNumberText: {
    color: theme.primaryText,
    fontSize: 18,
    fontWeight: '900',
  },
  stepText: {
    flex: 1,
    color: theme.text,
    fontSize: 20,
    lineHeight: 27,
    fontWeight: '900',
  },
  cameraFrame: {
    height: 330,
    overflow: 'hidden',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.primary,
    backgroundColor: theme.text,
  },
  cameraView: {
    flex: 1,
  },
  cameraHint: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    minHeight: 42,
    borderRadius: 8,
    textAlign: 'center',
    textAlignVertical: 'center',
    backgroundColor: theme.cameraOverlay,
    color: theme.inverseText,
    fontSize: 17,
    fontWeight: '900',
    paddingVertical: 10,
  },
  refreshButton: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
    backgroundColor: theme.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  refreshText: {
    color: theme.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  newsItem: {
    backgroundColor: theme.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    gap: 10,
  },
  newsTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  newsSource: {
    color: theme.blue,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  newsDate: {
    color: theme.textSubtle,
    fontSize: 13,
    fontWeight: '800',
  },
  newsTitle: {
    color: theme.text,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
  },
  lessonItem: {
    backgroundColor: theme.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    gap: 12,
  },
  lessonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  lessonTitle: {
    color: theme.text,
    fontSize: 22,
    fontWeight: '900',
  },
  lessonBody: {
    gap: 9,
  },
  rememberText: {
    color: theme.blue,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '900',
  },
  confidencePanel: {
    backgroundColor: theme.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    gap: 12,
  },
  practiceCard: {
    backgroundColor: theme.practice,
    borderRadius: 8,
    padding: 20,
    gap: 12,
  },
  practiceText: {
    color: theme.inverseText,
    fontSize: 24,
    lineHeight: 33,
    fontWeight: '900',
  },
  optionGrid: {
    gap: 10,
  },
  answerButton: {
    minHeight: 64,
    backgroundColor: theme.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  answerSelected: {
    borderColor: theme.selectedBorder,
    backgroundColor: theme.selected,
  },
  answerCorrect: {
    borderColor: theme.successBorder,
    backgroundColor: theme.primarySoft,
  },
  answerWrong: {
    borderColor: theme.dangerBorder,
    backgroundColor: theme.dangerSoft,
  },
  answerText: {
    color: theme.text,
    fontSize: 20,
    fontWeight: '900',
  },
  feedbackPanel: {
    backgroundColor: theme.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    gap: 12,
  },
  feedbackTitle: {
    color: theme.primary,
    fontSize: 24,
    fontWeight: '900',
  },
  feedbackWrong: {
    color: theme.danger,
  },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 106,
    paddingTop: 12,
    paddingBottom: 24,
    paddingHorizontal: 8,
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 70,
    borderRadius: 8,
  },
  navItemActive: {
    backgroundColor: theme.primarySoft,
  },
  navLabel: {
    color: theme.textSubtle,
    fontSize: 15,
    fontWeight: '900',
  },
  navLabelActive: {
    color: theme.primary,
  },
  modalScreen: {
    flex: 1,
    backgroundColor: theme.background,
  },
  modalHeader: {
    paddingTop: 56,
    paddingHorizontal: 18,
    paddingBottom: 12,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalTitle: {
    flex: 1,
    color: theme.danger,
    fontSize: 28,
    fontWeight: '900',
  },
  closeButton: {
    width: 52,
    height: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.disabledSurface,
  },
  modalContent: {
    padding: 18,
    paddingBottom: 36,
  },
  });
}
