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
  LayoutGrid,
  LifeBuoy,
  Link as LinkIcon,
  MessageCircle,
  Mic,
  Newspaper,
  Phone,
  PhoneCall,
  QrCode,
  Search,
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
  saveContacts,
  saveFamilyPhrase,
} from './src/services/storage';
import { AiScamReview, AnalysisResult, ConfidenceEntry, HfSpamReview, RiskLevel, ScamAlert, TrustedContact } from './src/types/app';
import { colors, font, radius, shadow, space, weight } from './src/theme';

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

const homeQuickChecks: ToolAction[] = [
  { screen: 'scam', label: 'Message', detail: 'Paste the words', icon: MessageCircle },
  { screen: 'call', label: 'Phone call', detail: 'Yes / no check', icon: PhoneCall },
  { screen: 'link', label: 'Link', detail: 'Before you tap', icon: LinkIcon },
  { screen: 'payment', label: 'Payment', detail: 'Before you pay', icon: CreditCard },
];

const openingSteps: Array<{ title: string; detail: string }> = [
  { title: 'Stop', detail: 'Take a breath' },
  { title: 'Check', detail: 'Use a tool' },
  { title: 'Call', detail: 'Someone you trust' },
];

function levelBackground(level: RiskLevel) {
  switch (level) {
    case 'stop':
      return colors.dangerTint;
    case 'high':
      return colors.highTint;
    case 'caution':
      return colors.warnTint;
    default:
      return colors.brandTint;
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
  const [screen, setScreen] = useState<Screen>('home');
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
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [screen, screenAnim]);

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
    const isHome = screen === 'home';
    return (
      <View style={styles.header}>
        {isHome ? (
          <View style={styles.brandRow}>
            <View style={styles.logoMark}>
              <ShieldCheck size={26} color={colors.white} strokeWidth={2.4} />
            </View>
            <View style={styles.brandText}>
              <Text style={styles.brandName}>Shield Our Elders</Text>
              <Text style={styles.brandTagline}>Your calm second opinion</Text>
            </View>
          </View>
        ) : (
          <View style={styles.headerNavRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigate('home')} activeOpacity={0.7}>
              <ChevronRight size={20} color={colors.brand} style={styles.backIcon} strokeWidth={2.6} />
              <Text style={styles.backText}>Home</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{screenTitles[screen]}</Text>
          </View>
        )}
      </View>
    );
  }

  function renderBottomNav() {
    const items: Array<{ screen: Screen; label: string; icon: LucideIcon }> = [
      { screen: 'home', label: 'Home', icon: Home },
      { screen: 'tools', label: 'Tools', icon: LayoutGrid },
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
            <TouchableOpacity key={item.screen} style={styles.navItem} onPress={() => navigate(item.screen)} activeOpacity={0.8}>
              <View style={[styles.navIconWrap, active && styles.navIconWrapActive]}>
                <Icon size={22} color={active ? colors.brand : colors.muted} strokeWidth={active ? 2.5 : 2.1} />
              </View>
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  function renderHome() {
    return (
      <View style={styles.stack}>
        <View style={styles.homeHero}>
          <Text style={styles.homeHeroTitle}>Not sure about it?{'\n'}Let's check together.</Text>
          <Text style={styles.homeHeroText}>Slow down and take one clear step before you reply, pay, or tap a link.</Text>
        </View>

        <View style={styles.stepFlow}>
          {openingSteps.map((step, index) => (
            <React.Fragment key={step.title}>
              <View style={styles.stepFlowItem}>
                <View style={styles.stepFlowBadge}>
                  <Text style={styles.stepFlowBadgeText}>{index + 1}</Text>
                </View>
                <Text style={styles.stepFlowTitle}>{step.title}</Text>
                <Text style={styles.stepFlowDetail}>{step.detail}</Text>
              </View>
              {index < openingSteps.length - 1 ? <View style={styles.stepFlowLine} /> : null}
            </React.Fragment>
          ))}
        </View>

        <TouchableOpacity
          style={styles.emergencyButton}
          activeOpacity={0.9}
          onPress={() => {
            setEmergencyVisible(true);
            navigate('emergency');
          }}
        >
          <View style={styles.emergencyIcon}>
            <Siren size={30} color={colors.white} strokeWidth={2.6} />
          </View>
          <View style={styles.emergencyTextWrap}>
            <Text style={styles.emergencyTitle}>I think this is a scam</Text>
            <Text style={styles.emergencySub}>Show me the safety steps</Text>
          </View>
          <ChevronRight size={26} color={colors.white} strokeWidth={2.4} />
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick checks</Text>
          <TouchableOpacity style={styles.textLinkButton} onPress={() => navigate('tools')}>
            <Text style={styles.inlineLink}>See all</Text>
            <ChevronRight size={18} color={colors.brand} strokeWidth={2.6} />
          </TouchableOpacity>
        </View>
        <View style={styles.tileGrid}>
          {homeQuickChecks.map((tool) => (
            <GridTile key={tool.screen} {...tool} onPress={() => navigate(tool.screen)} />
          ))}
        </View>

        <TrustedContactStrip contacts={contacts} onCall={callContact} onText={textContact} onManage={() => navigate('contacts')} />
      </View>
    );
  }

  function renderTools() {
    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>Pick the check that matches what just happened.</Text>
        {toolGroups.map((group) => (
          <View key={group.title} style={styles.toolSection}>
            <Text style={styles.toolSectionTitle}>{group.title}</Text>
            <View style={styles.tileGrid}>
              {group.items.map((tool) => (
                <GridTile key={tool.screen} {...tool} onPress={() => navigate(tool.screen)} />
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
    <KeyboardAvoidingView style={styles.app} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
                    outputRange: [18, 0],
                  }),
                },
              ],
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
            <Pressable style={styles.closeButton} onPress={() => setEmergencyVisible(false)}>
              <X size={24} color="#17212B" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>{renderEmergency()}</ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function GridTile({
  label,
  detail,
  icon: Icon,
  onPress,
  tone,
}: {
  label: string;
  detail: string;
  icon: LucideIcon;
  onPress: () => void;
  tone?: RiskLevel;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const color = tone ? getLevelColor(tone) : colors.brand;
  const press = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 5 }).start();
  return (
    <Animated.View style={[styles.tileWrap, { transform: [{ scale }] }]}>
      <Pressable
        style={styles.tile}
        onPress={onPress}
        onPressIn={() => press(0.96)}
        onPressOut={() => press(1)}
      >
        <View style={[styles.tileIcon, { backgroundColor: tone ? levelBackground(tone) : colors.brandTint }]}>
          <Icon size={26} color={color} strokeWidth={2.4} />
        </View>
        <Text style={styles.tileTitle}>{label}</Text>
        <Text style={styles.tileDetail}>{detail}</Text>
      </Pressable>
    </Animated.View>
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
  const color = getLevelColor(review.level);

  return (
    <View style={[styles.aiPanel, { backgroundColor: levelBackground(review.level), borderColor: color }]}>
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
          <AlertTriangle size={18} color={color} />
          <Text style={styles.bulletText}>{reason}</Text>
        </View>
      ))}
      <Text style={styles.nextTitle}>Do next</Text>
      {review.nextSteps.map((step) => (
        <View key={step} style={styles.bulletRow}>
          <CheckCircle2 size={19} color="#0B6E69" />
          <Text style={styles.bulletText}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

function AiReviewPanel({ review }: { review: AiScamReview }) {
  const color = getLevelColor(review.level);

  return (
    <View style={[styles.aiPanel, { backgroundColor: levelBackground(review.level), borderColor: color }]}>
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
          <AlertTriangle size={18} color={color} />
          <Text style={styles.bulletText}>{reason}</Text>
        </View>
      ))}
      <Text style={styles.nextTitle}>Do next</Text>
      {review.nextSteps.map((step) => (
        <View key={step} style={styles.bulletRow}>
          <CheckCircle2 size={19} color="#0B6E69" />
          <Text style={styles.bulletText}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

function RiskPanel({ result }: { result: AnalysisResult }) {
  const color = getLevelColor(result.level);
  const visibleFindings = [...result.findings].sort((left, right) => right.points - left.points).slice(0, 3);
  const hiddenFindingCount = Math.max(0, result.findings.length - visibleFindings.length);
  return (
    <View style={[styles.riskPanel, { backgroundColor: levelBackground(result.level), borderColor: color }]}>
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
              <AlertTriangle size={19} color={getLevelColor(finding.severity)} />
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
          <CheckCircle2 size={19} color="#0B6E69" />
          <Text style={styles.bulletText}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

function ToggleRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
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
  onManage,
  urgent,
}: {
  contacts: TrustedContact[];
  onCall: (contact: TrustedContact) => void;
  onText: (contact: TrustedContact) => void;
  onManage?: () => void;
  urgent?: boolean;
}) {
  return (
    <View style={[styles.contactStrip, urgent && styles.contactStripUrgent]}>
      <View style={styles.sectionHeader}>
        <Text style={styles.contactStripTitle}>Someone you trust</Text>
        {onManage ? (
          <TouchableOpacity style={styles.textLinkButton} onPress={onManage}>
            <Text style={styles.inlineLink}>{contacts.length ? 'Edit' : 'Add'}</Text>
            <ChevronRight size={18} color={colors.brand} strokeWidth={2.6} />
          </TouchableOpacity>
        ) : !contacts.length ? (
          <Text style={styles.smallMuted}>None saved</Text>
        ) : null}
      </View>
      {contacts.length ? (
        contacts.map((contact) => (
          <View key={contact.id} style={styles.contactRow}>
            <View style={styles.contactAvatar}>
              <Users size={22} color={colors.brand} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{contact.name || contact.label}</Text>
              <Text style={styles.smallMuted}>{contact.phone}</Text>
            </View>
            <TouchableOpacity style={styles.iconButton} onPress={() => onCall(contact)}>
              <Phone size={21} color={colors.brand} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => onText(contact)}>
              <MessageCircle size={21} color={colors.brand} />
            </TouchableOpacity>
          </View>
        ))
      ) : (
        <Text style={styles.cardBody}>Add a daughter, son, caregiver, friend, or neighbor so help is one tap away.</Text>
      )}
    </View>
  );
}



const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // Header ------------------------------------------------------------------
  header: {
    paddingTop: Platform.OS === 'ios' ? 58 : 40,
    paddingBottom: space.md,
    paddingHorizontal: space.xl,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  logoMark: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  brandText: {
    flex: 1,
  },
  brandName: {
    fontSize: font.h2,
    fontWeight: weight.bold,
    color: colors.ink,
    letterSpacing: -0.4,
  },
  brandTagline: {
    fontSize: font.label,
    color: colors.muted,
    fontWeight: weight.medium,
    marginTop: 1,
  },
  headerNavRow: {
    gap: space.xs,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  backIcon: {
    transform: [{ rotate: '180deg' }],
    marginRight: 2,
  },
  backText: {
    fontSize: font.bodySm,
    fontWeight: weight.semibold,
    color: colors.brand,
  },
  title: {
    fontSize: font.h1,
    fontWeight: weight.bold,
    color: colors.ink,
    letterSpacing: -0.5,
  },

  // Scroll body -------------------------------------------------------------
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: space.xl,
    paddingBottom: 130,
  },
  screenTransition: {
    flex: 1,
  },
  stack: {
    gap: space.lg,
  },

  // Home hero ---------------------------------------------------------------
  homeHero: {
    gap: space.sm,
    marginTop: space.xs,
  },
  homeHeroTitle: {
    fontSize: font.display,
    lineHeight: 39,
    fontWeight: weight.bold,
    color: colors.ink,
    letterSpacing: -0.7,
  },
  homeHeroText: {
    fontSize: font.body,
    lineHeight: 27,
    color: colors.inkSoft,
    fontWeight: weight.regular,
  },

  // Step flow (Stop / Check / Call) -----------------------------------------
  stepFlow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: space.lg,
    paddingHorizontal: space.sm,
    ...shadow.soft,
  },
  stepFlowItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 2,
  },
  stepFlowBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  stepFlowBadgeText: {
    fontSize: font.bodySm,
    fontWeight: weight.bold,
    color: colors.brand,
  },
  stepFlowTitle: {
    fontSize: font.bodySm,
    fontWeight: weight.bold,
    color: colors.ink,
  },
  stepFlowDetail: {
    fontSize: font.tiny,
    color: colors.muted,
    textAlign: 'center',
    fontWeight: weight.medium,
  },
  stepFlowLine: {
    width: 20,
    height: 2,
    backgroundColor: colors.lineStrong,
    marginTop: 18,
    borderRadius: 1,
  },

  // Emergency button --------------------------------------------------------
  emergencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.danger,
    borderRadius: radius.lg,
    padding: space.lg,
    ...shadow.card,
  },
  emergencyIcon: {
    width: 54,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyTextWrap: {
    flex: 1,
  },
  emergencyTitle: {
    fontSize: font.h3,
    fontWeight: weight.bold,
    color: colors.white,
    letterSpacing: -0.3,
  },
  emergencySub: {
    fontSize: font.bodySm,
    color: 'rgba(255, 255, 255, 0.88)',
    marginTop: 2,
    fontWeight: weight.regular,
  },

  // Section header ----------------------------------------------------------
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: font.h3,
    fontWeight: weight.bold,
    color: colors.ink,
    letterSpacing: -0.3,
  },
  textLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    paddingVertical: 4,
    paddingLeft: space.sm,
  },
  inlineLink: {
    fontSize: font.bodySm,
    fontWeight: weight.semibold,
    color: colors.brand,
  },

  // Tile grid ---------------------------------------------------------------
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: space.md,
  },
  tileWrap: {
    width: '48%',
  },
  tile: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
    gap: 6,
    ...shadow.soft,
  },
  tileIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tileTitle: {
    fontSize: font.body,
    fontWeight: weight.bold,
    color: colors.ink,
    letterSpacing: -0.2,
  },
  tileDetail: {
    fontSize: font.label,
    color: colors.muted,
    fontWeight: weight.medium,
  },

  // Trusted contact ---------------------------------------------------------
  contactStrip: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
    gap: space.md,
    ...shadow.soft,
  },
  contactStripUrgent: {
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerTint,
  },
  contactStripTitle: {
    fontSize: font.h3,
    fontWeight: weight.bold,
    color: colors.ink,
    letterSpacing: -0.3,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: font.bodySm,
    fontWeight: weight.semibold,
    color: colors.ink,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallMuted: {
    fontSize: font.label,
    color: colors.muted,
    fontWeight: weight.regular,
    lineHeight: 20,
  },

  // Generic card ------------------------------------------------------------
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
    gap: space.md,
    ...shadow.soft,
  },
  cardTitle: {
    fontSize: font.h3,
    fontWeight: weight.bold,
    color: colors.ink,
    letterSpacing: -0.3,
  },
  cardBody: {
    fontSize: font.bodySm,
    lineHeight: 24,
    color: colors.inkSoft,
    fontWeight: weight.regular,
  },

  // Screen intros -----------------------------------------------------------
  screenIntro: {
    fontSize: font.body,
    lineHeight: 26,
    color: colors.inkSoft,
    fontWeight: weight.medium,
  },
  screenIntroNarrow: {
    flex: 1,
    fontSize: font.bodySm,
    lineHeight: 23,
    color: colors.muted,
    fontWeight: weight.medium,
    paddingRight: space.md,
  },

  // Tools sections ----------------------------------------------------------
  toolSection: {
    gap: space.md,
  },
  toolSectionTitle: {
    fontSize: font.h3,
    fontWeight: weight.bold,
    color: colors.ink,
    letterSpacing: -0.3,
  },
  toolIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.sm,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Inputs ------------------------------------------------------------------
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    paddingHorizontal: space.lg,
    paddingVertical: 15,
    fontSize: font.body,
    color: colors.ink,
  },
  textArea: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    padding: space.lg,
    fontSize: font.body,
    lineHeight: 26,
    color: colors.ink,
    minHeight: 140,
  },
  textAreaSmall: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    padding: space.lg,
    fontSize: font.bodySm,
    lineHeight: 24,
    color: colors.ink,
    minHeight: 92,
  },

  // Buttons -----------------------------------------------------------------
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: 17,
    paddingHorizontal: space.xl,
    ...shadow.soft,
  },
  primaryButtonText: {
    fontSize: font.body,
    fontWeight: weight.bold,
    color: colors.white,
    letterSpacing: -0.2,
  },
  disabledButton: {
    backgroundColor: colors.bgWarm,
    borderColor: colors.line,
    shadowOpacity: 0,
    elevation: 0,
  },
  disabledText: {
    color: colors.faint,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  secondaryButtonWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: colors.brandTint,
    borderRadius: radius.md,
    paddingVertical: 16,
    paddingHorizontal: space.lg,
  },
  secondaryButtonWideText: {
    fontSize: font.bodySm,
    fontWeight: weight.semibold,
    color: colors.brand,
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: space.md,
  },
  secondaryActionText: {
    fontSize: font.label,
    fontWeight: weight.semibold,
    color: colors.brand,
  },

  // Risk / AI panels --------------------------------------------------------
  riskPanel: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.lg,
    gap: space.md,
    ...shadow.soft,
  },
  aiPanel: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.lg,
    gap: space.md,
    ...shadow.soft,
  },
  riskTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  riskTextColumn: {
    flex: 1,
    gap: 3,
  },
  riskLabel: {
    fontSize: font.tiny,
    fontWeight: weight.bold,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  riskHeadline: {
    fontSize: font.h3,
    fontWeight: weight.bold,
    color: colors.ink,
    letterSpacing: -0.3,
  },
  scoreBadge: {
    minWidth: 56,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  scoreText: {
    fontSize: font.h2,
    fontWeight: weight.bold,
  },
  findings: {
    gap: space.sm,
  },
  findingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
  },
  findingText: {
    flex: 1,
    gap: 1,
  },
  findingTitle: {
    fontSize: font.bodySm,
    fontWeight: weight.semibold,
    color: colors.ink,
  },
  findingDetail: {
    fontSize: font.label,
    lineHeight: 21,
    color: colors.inkSoft,
  },
  nextTitle: {
    fontSize: font.label,
    fontWeight: weight.bold,
    color: colors.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
  },
  bulletText: {
    flex: 1,
    fontSize: font.bodySm,
    lineHeight: 24,
    color: colors.inkSoft,
  },

  // Script / extracted text -------------------------------------------------
  scriptBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
    gap: 4,
  },
  scriptLabel: {
    fontSize: font.tiny,
    fontWeight: weight.bold,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  scriptText: {
    fontSize: font.bodySm,
    lineHeight: 24,
    color: colors.ink,
    fontWeight: weight.medium,
  },

  // AI helper boxes ---------------------------------------------------------
  aiActionBox: {
    gap: space.sm,
  },
  errorText: {
    fontSize: font.label,
    color: colors.danger,
    fontWeight: weight.medium,
    lineHeight: 20,
  },

  // Attachments -------------------------------------------------------------
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
  },
  attachmentImage: {
    width: 54,
    height: 54,
    borderRadius: radius.sm,
    backgroundColor: colors.bgWarm,
  },
  attachmentText: {
    flex: 1,
    gap: 1,
  },
  attachmentTitle: {
    fontSize: font.bodySm,
    fontWeight: weight.semibold,
    color: colors.ink,
  },

  // Toggle rows -------------------------------------------------------------
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
  },
  toggleLabel: {
    flex: 1,
    fontSize: font.bodySm,
    fontWeight: weight.medium,
    color: colors.ink,
    lineHeight: 22,
  },

  // Emergency modal + stop panel --------------------------------------------
  stopPanel: {
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.dangerTint,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    padding: space.xl,
  },
  stopTitle: {
    fontSize: font.h1,
    fontWeight: weight.bold,
    color: colors.danger,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  stopText: {
    fontSize: font.body,
    lineHeight: 26,
    color: colors.inkSoft,
    textAlign: 'center',
    fontWeight: weight.medium,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
    ...shadow.soft,
  },
  stepNumber: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: font.bodySm,
    fontWeight: weight.bold,
    color: colors.white,
  },
  stepText: {
    flex: 1,
    fontSize: font.bodySm,
    lineHeight: 24,
    color: colors.ink,
    fontWeight: weight.medium,
  },

  // News --------------------------------------------------------------------
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brandTint,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: space.md,
  },
  refreshText: {
    fontSize: font.label,
    fontWeight: weight.semibold,
    color: colors.brand,
  },
  newsItem: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
    gap: 6,
    ...shadow.soft,
  },
  newsTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  newsSource: {
    fontSize: font.tiny,
    fontWeight: weight.bold,
    color: colors.brand,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  newsDate: {
    fontSize: font.tiny,
    color: colors.faint,
    fontWeight: weight.medium,
  },
  newsTitle: {
    fontSize: font.h3,
    fontWeight: weight.bold,
    color: colors.ink,
    lineHeight: 25,
    letterSpacing: -0.3,
  },

  // Learn -------------------------------------------------------------------
  lessonItem: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
    gap: space.sm,
    ...shadow.soft,
  },
  lessonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  lessonTitle: {
    fontSize: font.h3,
    fontWeight: weight.bold,
    color: colors.ink,
    letterSpacing: -0.3,
  },
  lessonBody: {
    gap: space.sm,
    marginTop: space.xs,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  rememberText: {
    fontSize: font.bodySm,
    lineHeight: 24,
    color: colors.accent,
    fontWeight: weight.semibold,
    backgroundColor: colors.accentTint,
    borderRadius: radius.sm,
    padding: space.md,
    marginTop: space.xs,
  },

  // Practice / quiz ---------------------------------------------------------
  confidencePanel: {
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
    ...shadow.card,
  },
  metricTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricLabel: {
    fontSize: font.label,
    fontWeight: weight.semibold,
    color: 'rgba(255, 255, 255, 0.92)',
  },
  metricSmall: {
    fontSize: font.label,
    color: 'rgba(255, 255, 255, 0.78)',
    fontWeight: weight.medium,
  },
  metricValue: {
    fontSize: 40,
    fontWeight: weight.bold,
    color: colors.white,
    letterSpacing: -1,
  },
  practiceCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
    gap: space.sm,
    ...shadow.soft,
  },
  practiceText: {
    fontSize: font.body,
    lineHeight: 27,
    color: colors.ink,
    fontWeight: weight.medium,
  },
  optionGrid: {
    flexDirection: 'row',
    gap: space.sm,
  },
  answerButton: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
  },
  answerSelected: {
    borderColor: colors.info,
    backgroundColor: colors.infoTint,
  },
  answerCorrect: {
    borderColor: colors.low,
    backgroundColor: colors.lowTint,
  },
  answerWrong: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerTint,
  },
  answerText: {
    fontSize: font.bodySm,
    fontWeight: weight.semibold,
    color: colors.ink,
  },
  feedbackPanel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
    gap: space.md,
    ...shadow.soft,
  },
  feedbackTitle: {
    fontSize: font.h3,
    fontWeight: weight.bold,
    color: colors.low,
    letterSpacing: -0.3,
  },
  feedbackWrong: {
    color: colors.high,
  },

  // Progress bar ------------------------------------------------------------
  progressTrack: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.white,
  },

  // Bottom navigation -------------------------------------------------------
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: space.sm,
    paddingBottom: Platform.OS === 'ios' ? 28 : space.md,
    paddingHorizontal: space.sm,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  navIconWrap: {
    width: 52,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconWrapActive: {
    backgroundColor: colors.brandTint,
  },
  navLabel: {
    fontSize: font.tiny,
    fontWeight: weight.medium,
    color: colors.muted,
  },
  navLabelActive: {
    color: colors.brand,
    fontWeight: weight.bold,
  },

  // Emergency modal ---------------------------------------------------------
  modalScreen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 58 : 40,
    paddingBottom: space.md,
    paddingHorizontal: space.xl,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  modalTitle: {
    fontSize: font.h2,
    fontWeight: weight.bold,
    color: colors.ink,
    letterSpacing: -0.4,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    padding: space.xl,
    paddingBottom: 60,
  },

  // QR camera ---------------------------------------------------------------
  cameraFrame: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ink,
    ...shadow.card,
  },
  cameraView: {
    width: '100%',
    height: 280,
  },
  cameraHint: {
    fontSize: font.bodySm,
    fontWeight: weight.semibold,
    color: colors.white,
    textAlign: 'center',
    paddingVertical: space.md,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
});
