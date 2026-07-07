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
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import { AnalysisResult, ConfidenceEntry, RiskLevel, ScamAlert, TrustedContact } from './src/types/app';

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
  home: 'Shield Check',
  tools: 'Safety Tools',
  scam: 'Message Check',
  call: 'I Just Got a Call',
  emergency: 'Emergency',
  contacts: 'Trusted Contacts',
  link: 'Link Check',
  qr: 'QR Code Check',
  voice: 'Family Voice Check',
  payment: 'Before Paying',
  news: 'Scam Alerts',
  learn: 'Learn',
  practice: 'Practice',
  recovery: 'Recovery Guide',
  phone: 'Number Check',
  voicemail: 'Voicemail Notes',
};

const quickTools: Array<{ screen: Screen; label: string; detail: string; icon: LucideIcon; tone?: RiskLevel }> = [
  { screen: 'scam', label: 'Check a Message', detail: 'Text, email, screenshot, or transcript', icon: ShieldCheck },
  { screen: 'call', label: 'I Got a Call', detail: 'Answer simple yes/no questions', icon: PhoneCall },
  { screen: 'link', label: 'Check a Link', detail: 'Look before opening', icon: LinkIcon },
  { screen: 'qr', label: 'Scan a QR Code', detail: 'See where it goes first', icon: QrCode },
  { screen: 'voice', label: 'Family Voice Check', detail: 'Use a family phrase', icon: Mic },
  { screen: 'payment', label: 'Before Paying', detail: 'Gift cards, crypto, wire, Zelle', icon: CreditCard },
  { screen: 'phone', label: 'Check a Number', detail: 'Verify before calling back', icon: Search },
  { screen: 'voicemail', label: 'Voicemail Notes', detail: 'Paste what the caller said', icon: FileAudio },
  { screen: 'practice', label: 'Practice Examples', detail: 'Learn warning signs', icon: Trophy },
  { screen: 'recovery', label: 'I Already Clicked or Paid', detail: 'Do these steps now', icon: LifeBuoy, tone: 'high' },
];

const homePrimaryActions: Array<{ screen: Screen; label: string; detail: string; icon: LucideIcon; tone?: RiskLevel }> = [
  { screen: 'scam', label: 'Check a message', detail: 'Paste text, screenshot, or voicemail transcript.', icon: ShieldCheck },
  { screen: 'call', label: 'I got a call', detail: 'Answer five yes/no questions.', icon: PhoneCall },
  { screen: 'contacts', label: 'Call a trusted person', detail: 'Call or text someone you trust.', icon: Users },
];

const openingSteps: Array<{ title: string; detail?: string }> = [
  {
    title: '1. Stop. You have time.',
  },
  {
    title: '2. Pick one situation below.',
  },
  {
    title: '3. Verify with a trusted person.',
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
      return '#ECFDF5';
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
  const [screen, setScreen] = useState<Screen>('home');
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [confidence, setConfidence] = useState<ConfidenceEntry[]>([]);
  const [familyPhrase, setFamilyPhrase] = useState('');
  const [alerts, setAlerts] = useState<ScamAlert[]>([]);
  const [messageText, setMessageText] = useState('');
  const [screenshotUri, setScreenshotUri] = useState('');
  const [voicemailTranscript, setVoicemailTranscript] = useState('');
  const [voicemailFile, setVoicemailFile] = useState('');
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
  const latestConfidence = confidence.at(-1)?.score ?? 72;
  const practice = practiceExamples[practiceIndex % practiceExamples.length];

  function navigate(next: Screen) {
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
    });

    if (!result.canceled) setScreenshotUri(result.assets[0].uri);
  }

  async function pickVoicemail() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['audio/*', 'text/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (!result.canceled) {
      setVoicemailFile(result.assets[0].name);
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
            <Shield size={26} color="#FFFFFF" strokeWidth={2.6} />
          </View>
          <View style={styles.brandText}>
            <Text style={styles.eyebrow}>Project Shield Our Elders</Text>
            <Text style={styles.title}>{screenTitles[screen]}</Text>
          </View>
        </View>
        <View style={styles.privacyPill}>
          <ShieldCheck size={15} color="#0F766E" />
          <Text style={styles.privacyText}>Private by default</Text>
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
            <TouchableOpacity key={item.screen} style={styles.navItem} onPress={() => navigate(item.screen)} activeOpacity={0.75}>
              <Icon size={21} color={active ? '#0F766E' : '#667085'} strokeWidth={active ? 2.6 : 2.1} />
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
        <View style={styles.openingGuide}>
          <View style={styles.guideHeader}>
            <View style={styles.guideIcon}>
              <BookOpen size={25} color="#0F766E" strokeWidth={2.7} />
            </View>
            <View style={styles.guideTitleWrap}>
              <Text style={styles.guideEyebrow}>Start here</Text>
              <Text style={styles.guideTitle}>How to use this app</Text>
            </View>
          </View>
          <View style={styles.guideSteps}>
            {openingSteps.map((step) => (
              <View key={step.title} style={styles.guideStep}>
                <CheckCircle2 size={22} color="#0F766E" strokeWidth={2.7} />
                <View style={styles.guideStepText}>
                  <Text style={styles.guideStepTitle}>{step.title}</Text>
                  {step.detail ? <Text style={styles.guideStepDetail}>{step.detail}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        </View>

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
            <Text style={styles.emergencySub}>Tap for immediate steps</Text>
          </View>
          <ChevronRight size={30} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Choose one</Text>
          <TouchableOpacity style={styles.textLinkButton} onPress={() => navigate('tools')}>
            <Text style={styles.inlineLink}>All tools</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.actionList}>
          {homePrimaryActions.map((tool) => (
            <HomeActionButton key={tool.screen} {...tool} onPress={() => navigate(tool.screen)} />
          ))}
        </View>
      </View>
    );
  }

  function renderTools() {
    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>Choose the situation that matches what happened. Each check shows warning signs and the next safe step.</Text>
        <View style={styles.actionList}>
          {quickTools.map((tool) => (
            <ToolButton key={tool.screen} {...tool} onPress={() => navigate(tool.screen)} />
          ))}
        </View>
        <ToolButton screen="news" label="Scam Alerts" detail="Recent warning patterns" icon={Newspaper} onPress={() => navigate('news')} />
      </View>
    );
  }

  function renderScamCheck() {
    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>Paste message text, attach a screenshot, or add a voicemail transcript. Shield Check lists the warning signs in plain language.</Text>
        <TextInput
          style={styles.textArea}
          value={messageText}
          onChangeText={setMessageText}
          multiline
          textAlignVertical="top"
          placeholder="Paste the suspicious text, email, or social media message here."
          placeholderTextColor="#8A94A6"
        />
        <View style={styles.buttonRow}>
          <SecondaryAction icon={Upload} label="Upload screenshot" onPress={pickScreenshot} />
          <SecondaryAction icon={FileAudio} label="Voicemail file" onPress={pickVoicemail} />
        </View>
        {screenshotUri ? (
          <View style={styles.attachment}>
            <Image source={{ uri: screenshotUri }} style={styles.attachmentImage as ImageStyle} />
            <View style={styles.attachmentText}>
              <Text style={styles.attachmentTitle}>Screenshot attached</Text>
              <Text style={styles.smallMuted}>Paste visible text so Shield Check can review the words.</Text>
            </View>
            <TouchableOpacity onPress={() => setScreenshotUri('')}>
              <X size={22} color="#667085" />
            </TouchableOpacity>
          </View>
        ) : null}
        {voicemailFile ? <AttachmentLabel icon={FileAudio} label={voicemailFile} onClear={() => setVoicemailFile('')} /> : null}
        <TextInput
          style={styles.textAreaSmall}
          value={voicemailTranscript}
          onChangeText={setVoicemailTranscript}
          multiline
          textAlignVertical="top"
          placeholder="Optional: paste a voicemail transcript here."
          placeholderTextColor="#8A94A6"
        />
        <RiskPanel result={scamResult} />
      </View>
    );
  }

  function renderCallCheck() {
    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>Answer what happened on the call. If any answer is yes, slow down and verify before acting.</Text>
        <ToggleRow label="Did they ask for money?" value={callAnswers.money} onValueChange={(value) => setCallAnswers({ ...callAnswers, money: value })} />
        <ToggleRow label="Did they ask you not to tell anyone?" value={callAnswers.secret} onValueChange={(value) => setCallAnswers({ ...callAnswers, secret: value })} />
        <ToggleRow label="Did they ask for a verification code?" value={callAnswers.code} onValueChange={(value) => setCallAnswers({ ...callAnswers, code: value })} />
        <ToggleRow label="Did they ask for remote access?" value={callAnswers.remote} onValueChange={(value) => setCallAnswers({ ...callAnswers, remote: value })} />
        <ToggleRow label="Did they threaten arrest or account closure?" value={callAnswers.threat} onValueChange={(value) => setCallAnswers({ ...callAnswers, threat: value })} />
        <ToggleRow label="Are you relying only on caller ID?" value={callAnswers.callerId} onValueChange={(value) => setCallAnswers({ ...callAnswers, callerId: value })} />
        <RiskPanel result={callResult} />
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
          <Text style={styles.stopText}>Scammers rush people. A real bank, agency, or family member can wait while you verify.</Text>
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
        <Text style={styles.screenIntro}>Store one or two people to call before sending money, sharing codes, or opening links. Contacts stay on this device.</Text>
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
          <Text style={styles.cardBody}>Use this for family emergency or voice-clone calls. Do not make it public.</Text>
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
        <Text style={styles.screenIntro}>Paste a link before opening it. This checks domain tricks, shorteners, non-HTTPS links, and fake brand names.</Text>
        <TextInput
          style={styles.input}
          value={urlText}
          onChangeText={setUrlText}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://example.com"
          placeholderTextColor="#8A94A6"
        />
        <RiskPanel result={linkResult} />
        <TouchableOpacity style={styles.secondaryButtonWide} onPress={() => openUrl(urlText)}>
          <ExternalLink size={20} color="#0F766E" />
          <Text style={styles.secondaryButtonWideText}>Open destination only if expected</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderQrCheck() {
    const canScan = cameraPermission?.granted;

    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>Scan a QR code to see the destination first. The app warns before opening unknown or suspicious links.</Text>
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
          placeholder="Scanned QR destination appears here"
          placeholderTextColor="#8A94A6"
        />
        <RiskPanel result={qrResult} />
        <TouchableOpacity style={styles.secondaryButtonWide} onPress={() => openUrl(qrValue)} disabled={!qrValue.trim()}>
          <ExternalLink size={20} color="#0F766E" />
          <Text style={styles.secondaryButtonWideText}>Open destination only if verified</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderVoiceClone() {
    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>Use this when a voice claims to be family or a caregiver. The safest check is a private phrase and a call-back.</Text>
        <ToggleRow label="Are they claiming to be family?" value={voiceAnswers.family} onValueChange={(value) => setVoiceAnswers({ ...voiceAnswers, family: value })} />
        <ToggleRow label="Are they asking for money immediately?" value={voiceAnswers.money} onValueChange={(value) => setVoiceAnswers({ ...voiceAnswers, money: value })} />
        <ToggleRow label="Are they saying not to tell anyone?" value={voiceAnswers.secret} onValueChange={(value) => setVoiceAnswers({ ...voiceAnswers, secret: value })} />
        <ToggleRow label="Does the story feel shocking or emotional?" value={voiceAnswers.emotional} onValueChange={(value) => setVoiceAnswers({ ...voiceAnswers, emotional: value })} />
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
        <RiskPanel result={voiceResult} />
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
        <Text style={styles.screenIntro}>Before sending money, choose every payment method they mentioned. Some methods are common in scams because they are hard to reverse.</Text>
        {Object.entries(labels).map(([key, label]) => (
          <ToggleRow key={key} label={label} value={paymentAnswers[key]} onValueChange={(value) => setPaymentAnswers({ ...paymentAnswers, [key]: value })} />
        ))}
        <RiskPanel result={paymentResult} />
      </View>
    );
  }

  function renderNews() {
    return (
      <View style={styles.stack}>
        <View style={styles.sectionHeader}>
          <Text style={styles.screenIntroNarrow}>Recent scam patterns from public safety sources and Project Shield workshop notes.</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={refreshAlerts}>
            <Newspaper size={18} color="#0F766E" />
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
        <Text style={styles.screenIntro}>Short one-minute lessons. Open one, read the steps, then practice with examples.</Text>
        {lessons.map((lesson) => {
          const open = lessonOpen === lesson.id;
          return (
            <TouchableOpacity key={lesson.id} style={styles.lessonItem} onPress={() => setLessonOpen(open ? null : lesson.id)} activeOpacity={0.78}>
              <View style={styles.lessonHeader}>
                <View>
                  <Text style={styles.lessonTitle}>{lesson.title}</Text>
                  <Text style={styles.smallMuted}>{lesson.minutes} minute lesson</Text>
                </View>
                <GraduationCap size={24} color="#7C3AED" />
              </View>
              <Text style={styles.cardBody}>{lesson.summary}</Text>
              {open ? (
                <View style={styles.lessonBody}>
                  {lesson.steps.map((step) => (
                    <View key={step} style={styles.bulletRow}>
                      <CheckCircle2 size={19} color="#0F766E" />
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
          <Text style={styles.metricLabel}>Practice progress</Text>
          <Text style={styles.metricValue}>{latestConfidence}%</Text>
          <ProgressBar value={latestConfidence} />
        </View>
        <View style={styles.practiceCard}>
          <Text style={styles.newsSource}>{practice.channel}</Text>
          <Text style={styles.practiceText}>{practice.message}</Text>
        </View>
        <View style={styles.optionGrid}>
          {options.map((option) => {
            const isSelected = selectedPractice === option;
            const isCorrect = answered && practice.answer === option;
            return (
              <TouchableOpacity
                key={option}
                style={[styles.answerButton, isSelected && styles.answerSelected, isCorrect && styles.answerCorrect]}
                onPress={() => choosePractice(option)}
                activeOpacity={0.78}
              >
                {isCorrect ? <CheckCircle2 size={21} color="#0F766E" /> : <Circle size={21} color={isSelected ? '#7C3AED' : '#667085'} />}
                <Text style={styles.answerText}>{option[0].toUpperCase() + option.slice(1)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {answered ? (
          <View style={styles.feedbackPanel}>
            <Text style={styles.feedbackTitle}>{selectedPractice === practice.answer ? 'Correct' : `Answer: ${practice.answer}`}</Text>
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
          </View>
        ) : null}
      </View>
    );
  }

  function renderRecovery() {
    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>If someone already clicked, paid, shared a code, or gave remote access, act quickly and document everything.</Text>
        {recoverySteps.map((group) => (
          <View key={group.title} style={styles.card}>
            <Text style={styles.cardTitle}>{group.title}</Text>
            {group.items.map((item) => (
              <View key={item} style={styles.bulletRow}>
                <CheckCircle2 size={19} color="#0F766E" />
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
          <ExternalLink size={20} color="#0F766E" />
          <Text style={styles.secondaryButtonWideText}>Report internet fraud to IC3</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderPhoneLookup() {
    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>Paste a phone number. Local checks can identify a few public numbers and warning patterns; unknown still means verify independently.</Text>
        <TextInput
          style={styles.input}
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
          placeholder="Phone number"
          placeholderTextColor="#8A94A6"
        />
        <RiskPanel result={phoneResult} />
        <TouchableOpacity style={styles.secondaryButtonWide} onPress={openSearchForPhone} disabled={!phoneNumber.trim()}>
          <Search size={20} color="#0F766E" />
          <Text style={styles.secondaryButtonWideText}>Search public scam reports</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderVoicemail() {
    const voicemailResult = analyzeMessage(voicemailTranscript, 'voicemail transcript');
    return (
      <View style={styles.stack}>
        <Text style={styles.screenIntro}>Upload a voicemail file for the case record, then paste or type the transcript. The app highlights urgency, threats, gift cards, crypto, remote access, and code requests.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={pickVoicemail}>
          <FileAudio size={20} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Upload voicemail</Text>
        </TouchableOpacity>
        {voicemailFile ? <AttachmentLabel icon={FileAudio} label={voicemailFile} onClear={() => setVoicemailFile('')} /> : null}
        <TextInput
          style={styles.textArea}
          value={voicemailTranscript}
          onChangeText={setVoicemailTranscript}
          multiline
          textAlignVertical="top"
          placeholder="Paste voicemail transcript here."
          placeholderTextColor="#8A94A6"
        />
        <RiskPanel result={voicemailResult} />
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
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {screen !== 'home' ? (
          <TouchableOpacity style={styles.backButton} onPress={() => navigate('home')}>
            <ChevronRight size={18} color="#0F766E" style={styles.backIcon} />
            <Text style={styles.backText}>Home</Text>
          </TouchableOpacity>
        ) : null}
        {renderScreen()}
      </ScrollView>
      {renderBottomNav()}
      <Modal visible={emergencyVisible && screen === 'emergency'} animationType="slide" onRequestClose={() => setEmergencyVisible(false)}>
        <View style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Immediate Scam Safety</Text>
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

function HomeActionButton({
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
  const color = tone ? getLevelColor(tone) : '#0F766E';
  return (
    <TouchableOpacity style={styles.homeActionButton} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.homeActionIcon, { backgroundColor: tone ? levelBackground(tone) : '#E7F7F4' }]}>
        <Icon size={30} color={color} strokeWidth={2.6} />
      </View>
      <View style={styles.homeActionText}>
        <Text style={styles.homeActionTitle}>{label}</Text>
        <Text style={styles.homeActionDetail}>{detail}</Text>
      </View>
      <ChevronRight size={30} color={color} strokeWidth={2.7} />
    </TouchableOpacity>
  );
}

function ToolButton({
  label,
  detail,
  icon: Icon,
  onPress,
  tone,
}: {
  screen?: Screen;
  label: string;
  detail: string;
  icon: LucideIcon;
  onPress: () => void;
  tone?: RiskLevel;
}) {
  const color = tone ? getLevelColor(tone) : '#0F766E';
  return (
    <TouchableOpacity style={styles.toolButton} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.toolIcon, { backgroundColor: tone ? levelBackground(tone) : '#E7F7F4' }]}>
        <Icon size={28} color={color} strokeWidth={2.45} />
      </View>
      <View style={styles.toolText}>
        <Text style={styles.toolTitle}>{label}</Text>
        <Text style={styles.toolDetail}>{detail}</Text>
      </View>
      <ChevronRight size={26} color={color} strokeWidth={2.6} />
    </TouchableOpacity>
  );
}

function RiskPanel({ result }: { result: AnalysisResult }) {
  const color = getLevelColor(result.level);
  return (
    <View style={[styles.riskPanel, { backgroundColor: levelBackground(result.level), borderColor: color }]}>
      <View style={styles.riskTop}>
        <View>
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
          {result.findings.map((finding) => (
            <View key={finding.id} style={styles.findingRow}>
              <AlertTriangle size={19} color={getLevelColor(finding.severity)} />
              <View style={styles.findingText}>
                <Text style={styles.findingTitle}>{finding.title}</Text>
                <Text style={styles.findingDetail}>{finding.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.scriptBox}>
        <Text style={styles.scriptLabel}>Say this</Text>
        <Text style={styles.scriptText}>{result.script}</Text>
      </View>
      <Text style={styles.nextTitle}>Next steps</Text>
      {result.nextSteps.map((step) => (
        <View key={step} style={styles.bulletRow}>
          <CheckCircle2 size={19} color="#0F766E" />
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
        trackColor={{ false: '#D0D5DD', true: '#99F6E4' }}
        thumbColor={value ? '#0F766E' : '#F9FAFB'}
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
      <Icon size={19} color={disabled ? '#98A2B3' : '#0F766E'} />
      <Text style={[styles.secondaryActionText, disabled && styles.disabledText]}>{label}</Text>
    </TouchableOpacity>
  );
}

function AttachmentLabel({ icon: Icon, label, onClear }: { icon: LucideIcon; label: string; onClear: () => void }) {
  return (
    <View style={styles.attachment}>
      <View style={styles.toolIcon}>
        <Icon size={22} color="#0F766E" />
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
              <Users size={22} color="#0F766E" />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{contact.name || contact.label}</Text>
              <Text style={styles.smallMuted}>{contact.phone}</Text>
            </View>
            <TouchableOpacity style={styles.iconButton} onPress={() => onCall(contact)}>
              <Phone size={21} color="#0F766E" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => onText(contact)}>
              <MessageCircle size={21} color="#0F766E" />
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
    backgroundColor: '#F6F8F6',
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 18,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E7EC',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoMark: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    flex: 1,
  },
  eyebrow: {
    color: '#7C3AED',
    fontSize: 13,
    fontWeight: '800',
  },
  title: {
    color: '#17212B',
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 31,
  },
  privacyPill: {
    marginTop: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  privacyText: {
    color: '#0F766E',
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
    color: '#0F766E',
    fontSize: 16,
    fontWeight: '800',
  },
  openingGuide: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#B2DDFF',
    padding: 16,
    gap: 14,
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  guideIcon: {
    width: 54,
    height: 54,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideTitleWrap: {
    flex: 1,
  },
  guideEyebrow: {
    color: '#0F766E',
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  guideTitle: {
    marginTop: 2,
    color: '#17212B',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
  },
  guideSteps: {
    gap: 12,
  },
  guideStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  guideStepText: {
    flex: 1,
  },
  guideStepTitle: {
    color: '#17212B',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  guideStepDetail: {
    marginTop: 2,
    color: '#475467',
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '700',
  },
  emergencyButton: {
    minHeight: 132,
    backgroundColor: '#B42318',
    borderRadius: 8,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  emergencyTextWrap: {
    flex: 1,
  },
  emergencyTitle: {
    color: '#FFFFFF',
    fontSize: 29,
    fontWeight: '900',
    lineHeight: 36,
  },
  emergencySub: {
    marginTop: 4,
    color: '#FFE9E7',
    fontSize: 20,
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
    fontSize: 23,
    fontWeight: '900',
  },
  textLinkButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  inlineLink: {
    color: '#0F766E',
    fontSize: 18,
    fontWeight: '900',
  },
  actionList: {
    gap: 12,
  },
  homeActionButton: {
    minHeight: 102,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D0D5DD',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  homeActionIcon: {
    width: 58,
    height: 58,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeActionText: {
    flex: 1,
  },
  homeActionTitle: {
    color: '#17212B',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  homeActionDetail: {
    marginTop: 4,
    color: '#475467',
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
  },
  toolButton: {
    minHeight: 92,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D0D5DD',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  toolIcon: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#E7F7F4',
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
    backgroundColor: '#0F766E',
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
    backgroundColor: '#ECFDF5',
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
    backgroundColor: '#E7F7F4',
    borderWidth: 1,
    borderColor: '#99F6E4',
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
    borderColor: '#99F6E4',
    backgroundColor: '#ECFDF5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryActionText: {
    color: '#0F766E',
    fontSize: 17,
    fontWeight: '900',
  },
  secondaryButtonWide: {
    minHeight: 62,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#99F6E4',
    backgroundColor: '#ECFDF5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonWideText: {
    color: '#0F766E',
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
    backgroundColor: '#0F766E',
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
  riskTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
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
    color: '#7C3AED',
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
    borderColor: '#0F766E',
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
    borderColor: '#99F6E4',
    backgroundColor: '#ECFDF5',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  refreshText: {
    color: '#0F766E',
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
    color: '#7C3AED',
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
    color: '#7C3AED',
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
    backgroundColor: '#17212B',
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
    borderColor: '#A78BFA',
    backgroundColor: '#F5F3FF',
  },
  answerCorrect: {
    borderColor: '#5EEAD4',
    backgroundColor: '#ECFDF5',
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
    color: '#0F766E',
    fontSize: 22,
    fontWeight: '900',
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
  },
  navLabel: {
    color: '#667085',
    fontSize: 14,
    fontWeight: '900',
  },
  navLabelActive: {
    color: '#0F766E',
  },
  modalScreen: {
    flex: 1,
    backgroundColor: '#F6F8F6',
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
