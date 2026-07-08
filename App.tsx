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
  Settings,
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
  getLevelColor,
  labelForLevel,
} from './src/services/scamAnalyzer';
import {
  addConfidenceEntry,
  loadConfidence,
  loadContacts,
  loadFamilyPhrase,
  loadAccessibilitySettings,
  saveAccessibilitySettings,
  saveContacts,
  saveFamilyPhrase,
} from './src/services/storage';
import {
  AccessibilitySettings,
  AiScamReview,
  AnalysisResult,
  ConfidenceEntry,
  HfSpamReview,
  RiskLevel,
  ScamAlert,
  TrustedContact,
} from './src/types/app';

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
  | 'settings';

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
  settings: 'Settings',
};

const defaultAccessibilitySettings: AccessibilitySettings = {
  largeText: false,
  highContrast: false,
  reduceMotion: false,
};

const AccessibilityContext = React.createContext<AccessibilitySettings>(defaultAccessibilitySettings);

function useAccessibility() {
  return React.useContext(AccessibilityContext);
}

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

function levelBackground(level: RiskLevel) {
  switch (level) {
    case 'stop':
      return '#FFF1F0';
    case 'high':
      return '#FFF7ED';
    case 'caution':
      return '#FFFBEB';
    default:
      return '#EFF8F5';
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
  const scrollRef = useRef<ScrollView>(null);
  const screenAnim = useRef(new Animated.Value(1)).current;
  const noticeAnim = useRef(new Animated.Value(1)).current;
  const urgentPulse = useRef(new Animated.Value(0)).current;
  const [screen, setScreen] = useState<Screen>('home');
  const [liveNoticeIndex, setLiveNoticeIndex] = useState(0);
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [confidence, setConfidence] = useState<ConfidenceEntry[]>([]);
  const [accessibilitySettings, setAccessibilitySettings] = useState<AccessibilitySettings>(defaultAccessibilitySettings);
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
      const [storedContacts, storedConfidence, storedPhrase, storedAlerts, storedAccessibility] = await Promise.all([
        loadContacts(),
        loadConfidence(),
        loadFamilyPhrase(),
        fetchScamAlerts(),
        loadAccessibilitySettings(),
      ]);

      setContacts(storedContacts);
      setContactDrafts([
        storedContacts[0] ?? { id: 'contact-1', label: 'Trusted Contact 1', name: '', phone: '' },
        storedContacts[1] ?? { id: 'contact-2', label: 'Trusted Contact 2', name: '', phone: '' },
      ]);
      setConfidence(storedConfidence);
      setFamilyPhrase(storedPhrase);
      setAlerts(storedAlerts);
      setAccessibilitySettings(storedAccessibility);
    }

    hydrate();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    if (accessibilitySettings.reduceMotion) {
      screenAnim.setValue(1);
      return;
    }

    screenAnim.setValue(0);
    Animated.timing(screenAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [accessibilitySettings.reduceMotion, screen, screenAnim]);

  useEffect(() => {
    if (accessibilitySettings.reduceMotion) {
      noticeAnim.setValue(1);
      return;
    }

    noticeAnim.setValue(0);
    Animated.timing(noticeAnim, {
      toValue: 1,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [accessibilitySettings.reduceMotion, liveNoticeIndex, noticeAnim]);

  useEffect(() => {
    const noticeTimer = setInterval(() => {
      setLiveNoticeIndex((current) => (current + 1) % liveNotices.length);
    }, 5200);

    if (accessibilitySettings.reduceMotion) {
      urgentPulse.setValue(0);
      return () => clearInterval(noticeTimer);
    }

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
  }, [accessibilitySettings.reduceMotion, urgentPulse]);

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

  async function updateAccessibility(next: AccessibilitySettings) {
    setAccessibilitySettings(next);
    await saveAccessibilitySettings(next);
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
      <View style={[styles.header, accessibilitySettings.highContrast && styles.highContrastHeader]}>
        <View style={styles.brandRow}>
          <View style={styles.logoMark}>
            <Shield size={26} color="#FFFFFF" strokeWidth={2.6} />
          </View>
          <View style={styles.brandText}>
            <Text style={styles.eyebrow}>Shield Our Elders</Text>
            <Text
              style={[
                styles.title,
                accessibilitySettings.largeText && styles.largeTitle,
                accessibilitySettings.highContrast && styles.highContrastText,
              ]}
            >
              {screenTitles[screen]}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.headerSettingsButton,
              screen === 'settings' && styles.headerSettingsButtonActive,
              accessibilitySettings.highContrast && styles.highContrastPill,
            ]}
            onPress={() => navigate('settings')}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel="Open accessibility settings"
          >
            <Settings size={22} color={screen === 'settings' ? '#FFFFFF' : '#0B6E69'} strokeWidth={2.6} />
            <Text style={[styles.headerSettingsText, screen === 'settings' && styles.headerSettingsTextActive]}>Settings</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.privacyPill, accessibilitySettings.highContrast && styles.highContrastPill]}>
          <ShieldCheck size={15} color="#0B6E69" />
          <Text style={[styles.privacyText, accessibilitySettings.largeText && styles.largePrivacyText]}>Check before replying</Text>
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
      { screen: 'settings', label: 'Settings', icon: Settings },
    ];

    return (
      <View style={[styles.bottomNav, accessibilitySettings.highContrast && styles.highContrastBottomNav]}>
        {items.map((item) => {
          const Icon = item.icon;
          const active = screen === item.screen;
          return (
            <TouchableOpacity key={item.screen} style={[styles.navItem, active && styles.navItemActive]} onPress={() => navigate(item.screen)} activeOpacity={0.75}>
              <Icon size={21} color={active ? '#0B6E69' : '#667085'} strokeWidth={active ? 2.6 : 2.1} />
              <Text
                style={[
                  styles.navLabel,
                  active && styles.navLabelActive,
                  accessibilitySettings.largeText && styles.largeNavLabel,
                  accessibilitySettings.highContrast && styles.highContrastMutedText,
                  active && accessibilitySettings.highContrast && styles.highContrastActiveText,
                ]}
              >
                {item.label}
              </Text>
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
          <Text
            style={[
              styles.homeHeroTitle,
              accessibilitySettings.largeText && styles.largeHeroTitle,
              accessibilitySettings.highContrast && styles.highContrastText,
            ]}
          >
            Stop first. Then check.
          </Text>
          <Text
            style={[
              styles.homeHeroText,
              accessibilitySettings.largeText && styles.largeHeroText,
              accessibilitySettings.highContrast && styles.highContrastMutedText,
            ]}
          >
            Use one clear check before you reply, pay, or click.
          </Text>
          <View style={styles.briefStepRow}>
            {openingSteps.map((step) => (
              <View key={step.title} style={styles.briefStep}>
                <CheckCircle2 size={18} color="#0B6E69" strokeWidth={2.7} />
                <Text style={[styles.briefStepText, accessibilitySettings.largeText && styles.largeBriefStepText]}>{step.title}</Text>
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
          <Siren size={36} color="#FFFFFF" strokeWidth={2.8} />
          <View style={styles.emergencyTextWrap}>
            <Text style={styles.emergencyTitle}>I THINK THIS IS A SCAM</Text>
            <Text style={styles.emergencySub}>Show safety steps</Text>
          </View>
          <ChevronRight size={30} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, accessibilitySettings.largeText && styles.largeSectionTitle]}>What happened?</Text>
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
          placeholderTextColor="#8A94A6"
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
              <X size={22} color="#667085" />
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
          placeholderTextColor="#8A94A6"
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
          <Siren size={42} color="#B42318" strokeWidth={2.8} />
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
          <ExternalLink size={20} color="#FFFFFF" />
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
              placeholderTextColor="#8A94A6"
            />
            <TextInput
              style={styles.input}
              value={contact.phone}
              onChangeText={(value) =>
                setContactDrafts((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, phone: value } : item)))
              }
              keyboardType="phone-pad"
              placeholder="Phone number"
              placeholderTextColor="#8A94A6"
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
            placeholderTextColor="#8A94A6"
          />
          <TouchableOpacity style={styles.primaryButton} onPress={savePhrase}>
            <ShieldCheck size={20} color="#FFFFFF" />
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
          placeholderTextColor="#8A94A6"
        />
        {hasUrlInput ? <RiskPanel result={linkResult} /> : null}
        <SecondaryAction icon={X} label="Clear" onPress={() => setUrlText('')} disabled={!hasUrlInput} />
        <TouchableOpacity
          style={[styles.secondaryButtonWide, !hasUrlInput && styles.disabledButton]}
          onPress={() => openUrl(urlText)}
          disabled={!hasUrlInput}
        >
          <ExternalLink size={20} color={hasUrlInput ? '#0B6E69' : '#98A2B3'} />
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
            <Camera size={20} color="#FFFFFF" />
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
            <QrCode size={20} color="#FFFFFF" />
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
          placeholderTextColor="#8A94A6"
        />
        {hasQrInput ? <RiskPanel result={qrResult} /> : null}
        <SecondaryAction icon={X} label="Clear" onPress={() => setQrValue('')} disabled={!hasQrInput} />
        <TouchableOpacity
          style={[styles.secondaryButtonWide, !hasQrInput && styles.disabledButton]}
          onPress={() => openUrl(qrValue)}
          disabled={!hasQrInput}
        >
          <ExternalLink size={20} color={hasQrInput ? '#0B6E69' : '#98A2B3'} />
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
            placeholderTextColor="#8A94A6"
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
            <Newspaper size={18} color="#0B6E69" />
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
                <GraduationCap size={24} color="#245B8C" />
              </View>
              <Text style={styles.cardBody}>{lesson.summary}</Text>
              {open ? (
                <View style={styles.lessonBody}>
                  {lesson.steps.map((step) => (
                    <View key={step} style={styles.bulletRow}>
                      <CheckCircle2 size={19} color="#0B6E69" />
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
          <Trophy size={20} color="#FFFFFF" />
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
                  <CheckCircle2 size={21} color="#0B6E69" />
                ) : isWrong ? (
                  <X size={21} color="#B42318" />
                ) : (
                  <Circle size={21} color={isSelected ? '#245B8C' : '#667085'} />
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
                <AlertTriangle size={18} color="#C2410C" />
                <Text style={styles.bulletText}>{flag}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.primaryButton} onPress={nextPractice}>
              <ChevronRight size={20} color="#FFFFFF" />
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
                <CheckCircle2 size={19} color="#0B6E69" />
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </View>
        ))}
        <TouchableOpacity style={styles.primaryButton} onPress={() => Linking.openURL('https://reportfraud.ftc.gov/')}>
          <ExternalLink size={20} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Report fraud to FTC</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButtonWide} onPress={() => Linking.openURL('https://www.ic3.gov/')}>
          <ExternalLink size={20} color="#0B6E69" />
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
          placeholderTextColor="#8A94A6"
        />
        {hasPhoneInput ? <RiskPanel result={phoneResult} /> : null}
        <SecondaryAction icon={X} label="Clear" onPress={() => setPhoneNumber('')} disabled={!hasPhoneInput} />
        <TouchableOpacity
          style={[styles.secondaryButtonWide, !hasPhoneInput && styles.disabledButton]}
          onPress={openSearchForPhone}
          disabled={!hasPhoneInput}
        >
          <Search size={20} color={hasPhoneInput ? '#0B6E69' : '#98A2B3'} />
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
          <FileAudio size={20} color="#FFFFFF" />
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
          placeholderTextColor="#8A94A6"
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

  function renderSettings() {
    return (
      <View style={styles.stack}>
        <Text style={[styles.screenIntro, accessibilitySettings.largeText && styles.largeScreenIntro]}>
          Make the app easier to read and calmer to use.
        </Text>
        <View style={[styles.card, accessibilitySettings.highContrast && styles.highContrastCard]}>
          <Text style={[styles.cardTitle, accessibilitySettings.largeText && styles.largeCardTitle]}>Accessibility</Text>
          <AccessibilitySettingRow
            title="Larger text"
            detail="Makes the most important words bigger."
            value={accessibilitySettings.largeText}
            onValueChange={(largeText) => updateAccessibility({ ...accessibilitySettings, largeText })}
          />
          <AccessibilitySettingRow
            title="High contrast"
            detail="Makes panels and text easier to separate."
            value={accessibilitySettings.highContrast}
            onValueChange={(highContrast) => updateAccessibility({ ...accessibilitySettings, highContrast })}
          />
          <AccessibilitySettingRow
            title="Reduce motion"
            detail="Turns off sliding transitions and warning pulses."
            value={accessibilitySettings.reduceMotion}
            onValueChange={(reduceMotion) => updateAccessibility({ ...accessibilitySettings, reduceMotion })}
          />
        </View>
        <View style={[styles.accessibilityPreview, accessibilitySettings.highContrast && styles.highContrastPreview]}>
          <ShieldCheck size={30} color="#0B6E69" strokeWidth={2.6} />
          <View style={styles.accessibilityPreviewText}>
            <Text style={[styles.accessibilityPreviewTitle, accessibilitySettings.largeText && styles.largePreviewTitle]}>
              Preview
            </Text>
            <Text style={[styles.accessibilityPreviewBody, accessibilitySettings.largeText && styles.largePreviewBody]}>
              Stop first. Check the message. Call someone you trust.
            </Text>
          </View>
        </View>
        <SecondaryAction
          icon={X}
          label="Reset accessibility settings"
          onPress={() => updateAccessibility(defaultAccessibilitySettings)}
          disabled={
            !accessibilitySettings.largeText &&
            !accessibilitySettings.highContrast &&
            !accessibilitySettings.reduceMotion
          }
        />
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
      case 'settings':
        return renderSettings();
      default:
        return renderHome();
    }
  }

  return (
    <AccessibilityContext.Provider value={accessibilitySettings}>
    <KeyboardAvoidingView
      style={[styles.app, accessibilitySettings.highContrast && styles.highContrastApp]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="dark" />
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
              <ChevronRight size={18} color="#0B6E69" style={styles.backIcon} />
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
              <X size={24} color="#17212B" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>{renderEmergency()}</ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
    </AccessibilityContext.Provider>
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
  const accessibility = useAccessibility();
  const color = tone ? getLevelColor(tone) : '#0B6E69';
  return (
    <Pressable
      style={({ pressed }) => [
        styles.homeActionButton,
        accessibility.highContrast && styles.highContrastSurface,
        !last && styles.homeActionDivider,
        pressed && styles.pressedRow,
      ]}
      onPress={onPress}
    >
      <View style={[styles.homeActionIcon, { backgroundColor: tone ? levelBackground(tone) : '#E7F4F1' }]}>
        <Icon size={30} color={color} strokeWidth={2.6} />
      </View>
      <View style={styles.homeActionText}>
        <Text style={[styles.homeActionTitle, accessibility.largeText && styles.largeActionTitle, accessibility.highContrast && styles.highContrastText]}>{label}</Text>
        <Text style={[styles.homeActionDetail, accessibility.largeText && styles.largeActionDetail, accessibility.highContrast && styles.highContrastMutedText]}>{detail}</Text>
      </View>
      <ChevronRight size={30} color={color} strokeWidth={2.7} />
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
  const accessibility = useAccessibility();
  const color = tone ? getLevelColor(tone) : '#0B6E69';
  return (
    <Pressable
      style={({ pressed }) => [
        styles.toolButton,
        accessibility.highContrast && styles.highContrastSurface,
        !last && styles.homeActionDivider,
        pressed && styles.pressedRow,
      ]}
      onPress={onPress}
    >
      <View style={[styles.toolIcon, { backgroundColor: tone ? levelBackground(tone) : '#E7F4F1' }]}>
        <Icon size={28} color={color} strokeWidth={2.45} />
      </View>
      <View style={styles.toolText}>
        <Text style={[styles.toolTitle, accessibility.largeText && styles.largeActionTitle, accessibility.highContrast && styles.highContrastText]}>{label}</Text>
        <Text style={[styles.toolDetail, accessibility.largeText && styles.largeActionDetail, accessibility.highContrast && styles.highContrastMutedText]}>{detail}</Text>
      </View>
      <ChevronRight size={26} color={color} strokeWidth={2.6} />
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
  const accessibility = useAccessibility();
  const Icon = notice.icon;
  const color = getLevelColor(notice.level);
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
      <Animated.View
        style={[
          styles.liveNotice,
          accessibility.highContrast && styles.highContrastSurface,
          { opacity: progress, transform: [{ translateY }] },
        ]}
      >
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
                backgroundColor: levelBackground(notice.level),
                transform: [{ scale: pulseScale }],
              },
            ]}
          >
            <Icon size={27} color={color} strokeWidth={2.65} />
          </Animated.View>
          <View style={styles.liveNoticeText}>
            <Text style={[styles.liveNoticeTitle, accessibility.largeText && styles.largeNoticeTitle, accessibility.highContrast && styles.highContrastText]}>{notice.title}</Text>
            <Text style={[styles.liveNoticeBody, accessibility.largeText && styles.largeNoticeBody, accessibility.highContrast && styles.highContrastMutedText]}>{notice.body}</Text>
          </View>
          <ChevronRight size={25} color={color} strokeWidth={2.6} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

function ExtractedTextPanel({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.scriptBox}>
      <Text style={styles.scriptLabel}>{title}</Text>
      <Text style={styles.scriptText}>{text}</Text>
    </View>
  );
}

function SpamModelPanel({ review }: { review: HfSpamReview }) {
  const accessibility = useAccessibility();
  const color = getLevelColor(review.level);

  return (
    <View style={[styles.aiPanel, { backgroundColor: levelBackground(review.level), borderColor: color }, accessibility.highContrast && styles.highContrastPanel]}>
      <View style={styles.riskTop}>
        <View style={styles.riskTextColumn}>
          <Text style={[styles.riskLabel, { color }]}>SMS spam check</Text>
          <Text style={[styles.riskHeadline, accessibility.largeText && styles.largeRiskHeadline, accessibility.highContrast && styles.highContrastText]}>{review.headline}</Text>
        </View>
        <View style={[styles.scoreBadge, { borderColor: color }]}>
          <Text style={[styles.scoreText, { color }]}>{review.score}</Text>
        </View>
      </View>
      <Text style={[styles.cardBody, accessibility.largeText && styles.largeCardBody, accessibility.highContrast && styles.highContrastMutedText]}>{review.summary}</Text>
      <Text style={styles.nextTitle}>Why it was flagged</Text>
      {review.reasons.map((reason) => (
        <View key={reason} style={styles.bulletRow}>
          <AlertTriangle size={18} color={color} />
          <Text style={[styles.bulletText, accessibility.largeText && styles.largeBulletText, accessibility.highContrast && styles.highContrastMutedText]}>{reason}</Text>
        </View>
      ))}
      <Text style={styles.nextTitle}>Do next</Text>
      {review.nextSteps.map((step) => (
        <View key={step} style={styles.bulletRow}>
          <CheckCircle2 size={19} color="#0B6E69" />
          <Text style={[styles.bulletText, accessibility.largeText && styles.largeBulletText, accessibility.highContrast && styles.highContrastMutedText]}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

function AiReviewPanel({ review }: { review: AiScamReview }) {
  const accessibility = useAccessibility();
  const color = getLevelColor(review.level);

  return (
    <View style={[styles.aiPanel, { backgroundColor: levelBackground(review.level), borderColor: color }, accessibility.highContrast && styles.highContrastPanel]}>
      <View style={styles.riskTop}>
        <View style={styles.riskTextColumn}>
          <Text style={[styles.riskLabel, { color }]}>AI review</Text>
          <Text style={[styles.riskHeadline, accessibility.largeText && styles.largeRiskHeadline, accessibility.highContrast && styles.highContrastText]}>{review.headline}</Text>
        </View>
        <View style={[styles.scoreBadge, { borderColor: color }]}>
          <Text style={[styles.scoreText, { color }]}>{review.score}</Text>
        </View>
      </View>
      <Text style={[styles.cardBody, accessibility.largeText && styles.largeCardBody, accessibility.highContrast && styles.highContrastMutedText]}>{review.summary}</Text>
      {review.screenshotText ? (
        <View style={styles.scriptBox}>
          <Text style={styles.scriptLabel}>Read from screenshot</Text>
          <Text style={styles.scriptText}>{review.screenshotText}</Text>
        </View>
      ) : null}
      <Text style={styles.nextTitle}>Why it was flagged</Text>
      {review.reasons.map((reason) => (
        <View key={reason} style={styles.bulletRow}>
          <AlertTriangle size={18} color={color} />
          <Text style={[styles.bulletText, accessibility.largeText && styles.largeBulletText, accessibility.highContrast && styles.highContrastMutedText]}>{reason}</Text>
        </View>
      ))}
      <Text style={styles.nextTitle}>Do next</Text>
      {review.nextSteps.map((step) => (
        <View key={step} style={styles.bulletRow}>
          <CheckCircle2 size={19} color="#0B6E69" />
          <Text style={[styles.bulletText, accessibility.largeText && styles.largeBulletText, accessibility.highContrast && styles.highContrastMutedText]}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

function RiskPanel({ result }: { result: AnalysisResult }) {
  const accessibility = useAccessibility();
  const color = getLevelColor(result.level);
  const visibleFindings = [...result.findings].sort((left, right) => right.points - left.points).slice(0, 3);
  const hiddenFindingCount = Math.max(0, result.findings.length - visibleFindings.length);
  return (
    <View style={[styles.riskPanel, { backgroundColor: levelBackground(result.level), borderColor: color }, accessibility.highContrast && styles.highContrastPanel]}>
      <View style={styles.riskTop}>
        <View style={styles.riskTextColumn}>
          <Text style={[styles.riskLabel, { color }]}>{labelForLevel(result.level)}</Text>
          <Text style={[styles.riskHeadline, accessibility.largeText && styles.largeRiskHeadline, accessibility.highContrast && styles.highContrastText]}>{result.headline}</Text>
        </View>
        <View style={[styles.scoreBadge, { borderColor: color }]}>
          <Text style={[styles.scoreText, { color }]}>{result.score}</Text>
        </View>
      </View>
      <Text style={[styles.cardBody, accessibility.largeText && styles.largeCardBody, accessibility.highContrast && styles.highContrastMutedText]}>{result.summary}</Text>
      {result.findings.length ? (
        <View style={styles.findings}>
          <Text style={styles.nextTitle}>Main signs</Text>
          {visibleFindings.map((finding) => (
            <View key={finding.id} style={styles.findingRow}>
              <AlertTriangle size={19} color={getLevelColor(finding.severity)} />
              <View style={styles.findingText}>
                <Text style={[styles.findingTitle, accessibility.largeText && styles.largeFindingTitle, accessibility.highContrast && styles.highContrastText]}>{finding.title}</Text>
                <Text style={[styles.findingDetail, accessibility.largeText && styles.largeFindingDetail, accessibility.highContrast && styles.highContrastMutedText]}>{finding.detail}</Text>
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
          <CheckCircle2 size={19} color="#0B6E69" />
          <Text style={[styles.bulletText, accessibility.largeText && styles.largeBulletText, accessibility.highContrast && styles.highContrastMutedText]}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

function ToggleRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  const accessibility = useAccessibility();
  return (
    <View style={[styles.toggleRow, accessibility.highContrast && styles.highContrastSurface]}>
      <Text style={[styles.toggleLabel, accessibility.largeText && styles.largeToggleLabel, accessibility.highContrast && styles.highContrastText]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#D8DFDA', true: '#BFE3DA' }}
        thumbColor={value ? '#0B6E69' : '#F9FAFB'}
      />
    </View>
  );
}

function AccessibilitySettingRow({
  title,
  detail,
  value,
  onValueChange,
}: {
  title: string;
  detail: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const accessibility = useAccessibility();

  return (
    <View style={[styles.settingRow, accessibility.highContrast && styles.highContrastSettingRow]}>
      <View style={styles.settingText}>
        <Text style={[styles.settingTitle, accessibility.largeText && styles.largeSettingTitle]}>{title}</Text>
        <Text style={[styles.settingDetail, accessibility.largeText && styles.largeSettingDetail]}>{detail}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#D8DFDA', true: '#BFE3DA' }}
        thumbColor={value ? '#0B6E69' : '#F9FAFB'}
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
  return (
    <TouchableOpacity style={[styles.secondaryAction, disabled && styles.disabledButton]} onPress={onPress} disabled={disabled} activeOpacity={0.75}>
      <Icon size={19} color={disabled ? '#98A2B3' : '#0B6E69'} />
      <Text style={[styles.secondaryActionText, disabled && styles.disabledText]}>{label}</Text>
    </TouchableOpacity>
  );
}

function AttachmentLabel({ icon: Icon, label, onClear }: { icon: LucideIcon; label: string; onClear: () => void }) {
  return (
    <View style={styles.attachment}>
      <View style={styles.toolIcon}>
        <Icon size={22} color="#0B6E69" />
      </View>
      <View style={styles.attachmentText}>
        <Text style={styles.attachmentTitle}>{label}</Text>
        <Text style={styles.smallMuted}>Attached on this device</Text>
      </View>
      <TouchableOpacity onPress={onClear}>
        <X size={22} color="#667085" />
      </TouchableOpacity>
    </View>
  );
}

function ProgressBar({ value }: { value: number }) {
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
  const accessibility = useAccessibility();
  return (
    <View style={[styles.contactStrip, urgent && styles.contactStripUrgent, accessibility.highContrast && styles.highContrastSurface]}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, accessibility.largeText && styles.largeSectionTitle, accessibility.highContrast && styles.highContrastText]}>Trusted Contact</Text>
        {!contacts.length ? <Text style={styles.smallMuted}>None saved</Text> : null}
      </View>
      {contacts.length ? (
        contacts.map((contact) => (
          <View key={contact.id} style={styles.contactRow}>
            <View style={styles.contactAvatar}>
              <Users size={22} color="#0B6E69" />
            </View>
            <View style={styles.contactInfo}>
              <Text style={[styles.contactName, accessibility.largeText && styles.largeContactName, accessibility.highContrast && styles.highContrastText]}>{contact.name || contact.label}</Text>
              <Text style={styles.smallMuted}>{contact.phone}</Text>
            </View>
            <TouchableOpacity style={styles.iconButton} onPress={() => onCall(contact)}>
              <Phone size={21} color="#0B6E69" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => onText(contact)}>
              <MessageCircle size={21} color="#0B6E69" />
            </TouchableOpacity>
          </View>
        ))
      ) : (
        <Text style={[styles.cardBody, accessibility.largeText && styles.largeCardBody, accessibility.highContrast && styles.highContrastMutedText]}>
          Add a daughter, son, caregiver, friend, or neighbor so help is one tap away.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: '#F4F7F5',
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#FEFFFE',
    borderBottomWidth: 1,
    borderBottomColor: '#DDE4DE',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoMark: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: '#0B6E69',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    flex: 1,
  },
  headerSettingsButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFE3DA',
    backgroundColor: '#EFF8F5',
  },
  headerSettingsButtonActive: {
    backgroundColor: '#0B6E69',
    borderColor: '#0B6E69',
  },
  headerSettingsText: {
    color: '#0B6E69',
    fontSize: 15,
    fontWeight: '900',
  },
  headerSettingsTextActive: {
    color: '#FFFFFF',
  },
  eyebrow: {
    color: '#245B8C',
    fontSize: 13,
    fontWeight: '800',
  },
  title: {
    color: '#17212B',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 29,
  },
  privacyPill: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#EFF8F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C9E8DF',
  },
  privacyText: {
    color: '#0B6E69',
    fontSize: 13,
    fontWeight: '800',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 128,
  },
  screenTransition: {
    flex: 1,
  },
  stack: {
    gap: 16,
  },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingRight: 12,
    marginBottom: 8,
  },
  backIcon: {
    transform: [{ rotate: '180deg' }],
  },
  backText: {
    color: '#0B6E69',
    fontSize: 16,
    fontWeight: '800',
  },
  homeHero: {
    paddingTop: 2,
    paddingBottom: 2,
    gap: 10,
  },
  homeHeroLabel: {
    color: '#0B6E69',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  homeHeroTitle: {
    color: '#17212B',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
  },
  homeHeroText: {
    color: '#475467',
    fontSize: 19,
    lineHeight: 28,
    fontWeight: '700',
  },
  briefStepRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  briefStep: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#EFF8F5',
  },
  briefStepText: {
    color: '#17212B',
    fontSize: 16,
    fontWeight: '900',
  },
  liveNotice: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDE4DE',
    padding: 14,
    gap: 10,
    shadowColor: '#344054',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  liveNoticePressed: {
    transform: [{ scale: 0.995 }],
  },
  liveNoticeTop: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  liveNoticeKicker: {
    color: '#245B8C',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  liveNoticeBadge: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  liveNoticeBadgeText: {
    fontSize: 13,
    fontWeight: '900',
  },
  liveNoticeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  liveNoticeIcon: {
    width: 54,
    height: 54,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveNoticeText: {
    flex: 1,
  },
  liveNoticeTitle: {
    color: '#17212B',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
  },
  liveNoticeBody: {
    marginTop: 3,
    color: '#475467',
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '700',
  },
  emergencyButton: {
    minHeight: 108,
    backgroundColor: '#B3261E',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#7A271A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  },
  emergencyTextWrap: {
    flex: 1,
  },
  emergencyTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
    lineHeight: 31,
  },
  emergencySub: {
    marginTop: 4,
    color: '#FFE9E7',
    fontSize: 18,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    color: '#17212B',
    fontSize: 24,
    fontWeight: '900',
  },
  textLinkButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  inlineLink: {
    color: '#0B6E69',
    fontSize: 18,
    fontWeight: '900',
  },
  actionList: {
    gap: 12,
  },
  homeActionGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDE4DE',
    overflow: 'hidden',
    shadowColor: '#344054',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 1,
  },
  toolListGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDE4DE',
    overflow: 'hidden',
    shadowColor: '#344054',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 1,
  },
  toolSection: {
    gap: 8,
  },
  toolSectionTitle: {
    color: '#344054',
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '900',
  },
  homeActionButton: {
    minHeight: 90,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  homeActionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E4E9E5',
  },
  pressedRow: {
    backgroundColor: '#F1F7F5',
    transform: [{ scale: 0.995 }],
  },
  homeActionIcon: {
    width: 54,
    height: 54,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeActionText: {
    flex: 1,
  },
  homeActionTitle: {
    color: '#17212B',
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
  },
  homeActionDetail: {
    marginTop: 4,
    color: '#475467',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  toolButton: {
    minHeight: 92,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  toolIcon: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#E7F4F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolText: {
    flex: 1,
  },
  toolTitle: {
    color: '#17212B',
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
  },
  toolDetail: {
    marginTop: 3,
    color: '#667085',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  metricLabel: {
    color: '#667085',
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
    color: '#475467',
    fontSize: 15,
    fontWeight: '900',
  },
  metricValue: {
    color: '#17212B',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E4E7EC',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0B6E69',
  },
  contactStrip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    padding: 14,
    gap: 12,
  },
  contactStripUrgent: {
    borderColor: '#FDA29B',
    backgroundColor: '#FFF8F7',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 68,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF8F5',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    color: '#17212B',
    fontSize: 17,
    fontWeight: '900',
  },
  iconButton: {
    width: 54,
    height: 54,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E7F4F1',
    borderWidth: 1,
    borderColor: '#BFE3DA',
  },
  screenIntro: {
    color: '#344054',
    fontSize: 19,
    lineHeight: 29,
    fontWeight: '700',
  },
  screenIntroNarrow: {
    flex: 1,
    color: '#344054',
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600',
  },
  textArea: {
    minHeight: 170,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    backgroundColor: '#FFFFFF',
    padding: 14,
    color: '#17212B',
    fontSize: 19,
    lineHeight: 28,
    fontWeight: '600',
  },
  textAreaSmall: {
    minHeight: 110,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    backgroundColor: '#FFFFFF',
    padding: 14,
    color: '#17212B',
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
  },
  input: {
    minHeight: 62,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    color: '#17212B',
    fontSize: 19,
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  secondaryAction: {
    minHeight: 56,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFE3DA',
    backgroundColor: '#EFF8F5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryActionText: {
    color: '#0B6E69',
    fontSize: 17,
    fontWeight: '900',
  },
  secondaryButtonWide: {
    minHeight: 62,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFE3DA',
    backgroundColor: '#EFF8F5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonWideText: {
    color: '#0B6E69',
    fontSize: 18,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.45,
  },
  disabledText: {
    color: '#98A2B3',
  },
  primaryButton: {
    minHeight: 64,
    borderRadius: 8,
    paddingHorizontal: 14,
    backgroundColor: '#0B6E69',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
  },
  attachment: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  attachmentImage: {
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: '#F2F4F7',
  },
  attachmentText: {
    flex: 1,
  },
  attachmentTitle: {
    color: '#17212B',
    fontSize: 16,
    fontWeight: '900',
  },
  smallMuted: {
    color: '#667085',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  riskPanel: {
    borderRadius: 8,
    borderWidth: 1.5,
    padding: 15,
    gap: 12,
  },
  aiPanel: {
    borderRadius: 8,
    borderWidth: 1.5,
    padding: 15,
    gap: 12,
  },
  aiActionBox: {
    gap: 8,
  },
  errorText: {
    color: '#B42318',
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
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  riskHeadline: {
    marginTop: 3,
    color: '#17212B',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    maxWidth: 260,
  },
  scoreBadge: {
    width: 58,
    height: 58,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  scoreText: {
    fontSize: 24,
    fontWeight: '900',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    padding: 14,
    gap: 12,
  },
  cardTitle: {
    color: '#17212B',
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
  },
  cardBody: {
    color: '#344054',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
  },
  findingText: {
    flex: 1,
  },
  findingTitle: {
    color: '#17212B',
    fontSize: 18,
    fontWeight: '900',
  },
  findingDetail: {
    marginTop: 3,
    color: '#475467',
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '700',
  },
  scriptBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },
  scriptLabel: {
    color: '#245B8C',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  scriptText: {
    marginTop: 5,
    color: '#17212B',
    fontSize: 19,
    lineHeight: 27,
    fontWeight: '800',
  },
  nextTitle: {
    color: '#17212B',
    fontSize: 18,
    fontWeight: '900',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletText: {
    flex: 1,
    color: '#344054',
    fontSize: 18,
    lineHeight: 27,
    fontWeight: '700',
  },
  toggleRow: {
    minHeight: 78,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  toggleLabel: {
    flex: 1,
    color: '#17212B',
    fontSize: 19,
    lineHeight: 27,
    fontWeight: '800',
  },
  stopPanel: {
    backgroundColor: '#FFF1F0',
    borderColor: '#FDA29B',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    gap: 9,
  },
  stopTitle: {
    color: '#B42318',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
  },
  stopText: {
    color: '#344054',
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '700',
  },
  stepRow: {
    minHeight: 62,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNumber: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B42318',
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  stepText: {
    flex: 1,
    color: '#17212B',
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '900',
  },
  cameraFrame: {
    height: 330,
    overflow: 'hidden',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#0B6E69',
    backgroundColor: '#17212B',
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
    backgroundColor: 'rgba(23,33,43,0.82)',
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    paddingVertical: 10,
  },
  refreshButton: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFE3DA',
    backgroundColor: '#EFF8F5',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  refreshText: {
    color: '#0B6E69',
    fontSize: 15,
    fontWeight: '900',
  },
  newsItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    padding: 14,
    gap: 8,
  },
  newsTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  newsSource: {
    color: '#245B8C',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  newsDate: {
    color: '#667085',
    fontSize: 13,
    fontWeight: '800',
  },
  newsTitle: {
    color: '#17212B',
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '900',
  },
  lessonItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    padding: 14,
    gap: 10,
  },
  lessonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  lessonTitle: {
    color: '#17212B',
    fontSize: 20,
    fontWeight: '900',
  },
  lessonBody: {
    gap: 9,
  },
  rememberText: {
    color: '#245B8C',
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '900',
  },
  confidencePanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    padding: 14,
    gap: 9,
  },
  practiceCard: {
    backgroundColor: '#183A4A',
    borderRadius: 8,
    padding: 18,
    gap: 10,
  },
  practiceText: {
    color: '#FFFFFF',
    fontSize: 23,
    lineHeight: 31,
    fontWeight: '900',
  },
  optionGrid: {
    gap: 10,
  },
  answerButton: {
    minHeight: 58,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  answerSelected: {
    borderColor: '#9BC3DF',
    backgroundColor: '#EDF6FB',
  },
  answerCorrect: {
    borderColor: '#5EEAD4',
    backgroundColor: '#EFF8F5',
  },
  answerWrong: {
    borderColor: '#FDA29B',
    backgroundColor: '#FFF1F0',
  },
  answerText: {
    color: '#17212B',
    fontSize: 18,
    fontWeight: '900',
  },
  feedbackPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    padding: 14,
    gap: 10,
  },
  feedbackTitle: {
    color: '#0B6E69',
    fontSize: 22,
    fontWeight: '900',
  },
  feedbackWrong: {
    color: '#B42318',
  },
  settingRow: {
    minHeight: 84,
    borderTopWidth: 1,
    borderTopColor: '#E4E7EC',
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    color: '#17212B',
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '900',
  },
  settingDetail: {
    marginTop: 3,
    color: '#475467',
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '700',
  },
  accessibilityPreview: {
    minHeight: 96,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFE3DA',
    backgroundColor: '#EFF8F5',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  accessibilityPreviewText: {
    flex: 1,
  },
  accessibilityPreviewTitle: {
    color: '#0B6E69',
    fontSize: 18,
    fontWeight: '900',
  },
  accessibilityPreviewBody: {
    marginTop: 4,
    color: '#17212B',
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '800',
  },
  largeTitle: {
    fontSize: 28,
    lineHeight: 34,
  },
  largePrivacyText: {
    fontSize: 15,
  },
  largeHeroTitle: {
    fontSize: 36,
    lineHeight: 42,
  },
  largeHeroText: {
    fontSize: 22,
    lineHeight: 32,
  },
  largeBriefStepText: {
    fontSize: 18,
  },
  largeSectionTitle: {
    fontSize: 28,
    lineHeight: 34,
  },
  largeScreenIntro: {
    fontSize: 22,
    lineHeight: 32,
  },
  largeActionTitle: {
    fontSize: 24,
    lineHeight: 31,
  },
  largeActionDetail: {
    fontSize: 19,
    lineHeight: 27,
  },
  largeNoticeTitle: {
    fontSize: 23,
    lineHeight: 29,
  },
  largeNoticeBody: {
    fontSize: 19,
    lineHeight: 28,
  },
  largeRiskHeadline: {
    fontSize: 25,
    lineHeight: 32,
    maxWidth: 300,
  },
  largeCardTitle: {
    fontSize: 24,
    lineHeight: 30,
  },
  largeCardBody: {
    fontSize: 20,
    lineHeight: 30,
  },
  largeBulletText: {
    fontSize: 20,
    lineHeight: 30,
  },
  largeFindingTitle: {
    fontSize: 20,
  },
  largeFindingDetail: {
    fontSize: 19,
    lineHeight: 28,
  },
  largeToggleLabel: {
    fontSize: 21,
    lineHeight: 30,
  },
  largeSettingTitle: {
    fontSize: 22,
    lineHeight: 29,
  },
  largeSettingDetail: {
    fontSize: 19,
    lineHeight: 28,
  },
  largePreviewTitle: {
    fontSize: 21,
  },
  largePreviewBody: {
    fontSize: 22,
    lineHeight: 32,
  },
  largeContactName: {
    fontSize: 20,
  },
  largeNavLabel: {
    fontSize: 15,
  },
  highContrastApp: {
    backgroundColor: '#FFFFFF',
  },
  highContrastHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#101828',
  },
  highContrastBottomNav: {
    borderTopColor: '#101828',
  },
  highContrastSurface: {
    backgroundColor: '#FFFFFF',
    borderColor: '#101828',
  },
  highContrastCard: {
    borderColor: '#101828',
  },
  highContrastPanel: {
    borderColor: '#101828',
  },
  highContrastPreview: {
    backgroundColor: '#FFFFFF',
    borderColor: '#101828',
  },
  highContrastPill: {
    backgroundColor: '#FFFFFF',
    borderColor: '#101828',
  },
  highContrastSettingRow: {
    borderTopColor: '#101828',
  },
  highContrastText: {
    color: '#101828',
  },
  highContrastMutedText: {
    color: '#101828',
  },
  highContrastActiveText: {
    color: '#064E4A',
  },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 98,
    paddingTop: 10,
    paddingBottom: 24,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E4E7EC',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 64,
    borderRadius: 8,
  },
  navItemActive: {
    backgroundColor: '#EFF8F5',
  },
  navLabel: {
    color: '#667085',
    fontSize: 14,
    fontWeight: '900',
  },
  navLabelActive: {
    color: '#0B6E69',
  },
  modalScreen: {
    flex: 1,
    backgroundColor: '#F4F7F5',
  },
  modalHeader: {
    paddingTop: 56,
    paddingHorizontal: 18,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E7EC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalTitle: {
    flex: 1,
    color: '#B42318',
    fontSize: 25,
    fontWeight: '900',
  },
  closeButton: {
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F4F7',
  },
  modalContent: {
    padding: 18,
    paddingBottom: 36,
  },
});
