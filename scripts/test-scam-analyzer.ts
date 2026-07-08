import {
  analyzeCallChecklist,
  analyzeMessage,
  analyzePayments,
  analyzePhoneNumber,
  analyzeUrl,
  analyzeVoiceClone,
} from '../src/services/scamAnalyzer';
import { combineModelReviews, createHfSpamReviewFromChatContent, createHfSpamReviewFromScores } from '../src/services/huggingFaceSpam';
import { practiceExamples } from '../src/data/content';
import { RiskLevel } from '../src/types/app';

type MessageCase = {
  name: string;
  text: string;
  minimum?: RiskLevel;
  maximum?: RiskLevel;
  mustFind: string[];
};

const levelRank: Record<RiskLevel, number> = {
  low: 0,
  caution: 1,
  high: 2,
  stop: 3,
};

function expectAtLeast(name: string, actual: RiskLevel, expected: RiskLevel) {
  assert(levelRank[actual] >= levelRank[expected], `${name}: expected at least ${expected}, got ${actual}`);
}

function expectAtMost(name: string, actual: RiskLevel, expected: RiskLevel) {
  assert(levelRank[actual] <= levelRank[expected], `${name}: expected at most ${expected}, got ${actual}`);
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const messageCases: MessageCase[] = [
  {
    name: 'Amazon invoice callback scam',
    text: 'Your Amazon account has been charged $799. Call 844-555-0199 immediately if this was not you.',
    minimum: 'high' as RiskLevel,
    mustFind: ['unexpected-charge', 'callback-number', 'not-you-cancel'],
  },
  {
    name: 'Bank verification code scam',
    text: 'This is your bank fraud department. Read me the six digit verification code we just sent so I can stop the theft.',
    minimum: 'high' as RiskLevel,
    mustFind: ['verification-code', 'bank-agency-impersonation'],
  },
  {
    name: 'Gift card payment demand',
    text: 'Go to Target now, buy four Apple gift cards, scratch off the back, and read the numbers to me.',
    minimum: 'stop' as RiskLevel,
    mustFind: ['gift-card'],
  },
  {
    name: 'Remote access tech support',
    text: 'Microsoft support detected hackers. Download AnyDesk so we can secure your bank account.',
    minimum: 'high' as RiskLevel,
    mustFind: ['remote-access', 'bank-agency-impersonation'],
  },
  {
    name: 'Package delivery fake fee link',
    text: 'USPS failed delivery. Pay the $0.30 redelivery fee now at usps-delivery-help.example/pay',
    minimum: 'caution' as RiskLevel,
    mustFind: ['delivery-toll-fee', 'bank-agency-impersonation'],
  },
  {
    name: 'Safe appointment reminder',
    text: 'Reminder: your dental appointment is Tuesday at 10 AM. Please call the number on your appointment card if you need to reschedule.',
    maximum: 'low' as RiskLevel,
    mustFind: [],
  },
];

for (const testCase of messageCases) {
  const result = analyzeMessage(testCase.text);
  if (testCase.minimum) expectAtLeast(testCase.name, result.level, testCase.minimum);
  if (testCase.maximum) expectAtMost(testCase.name, result.level, testCase.maximum);
  for (const id of testCase.mustFind) {
    assert(result.findings.some((finding) => finding.id === id), `${testCase.name}: missing ${id}`);
  }
}

expectAtLeast(
  'Call checklist money + secrecy + code',
  analyzeCallChecklist({ money: true, secret: true, code: true, remote: false, threat: false, callerId: false }).level,
  'stop',
);

expectAtLeast(
  'Voice clone family emergency',
  analyzeVoiceClone({ family: true, money: true, secret: true, emotional: true }, '').level,
  'stop',
);

expectAtLeast(
  'Payment checker crypto + Zelle',
  analyzePayments({ giftCard: false, crypto: true, wire: false, zelle: true, cashApp: false, venmo: false, bankCard: false }).level,
  'caution',
);

expectAtLeast('Fake brand domain', analyzeUrl('https://amazon-account-security.example/login').level, 'high');
expectAtMost('Official FTC report URL', analyzeUrl('https://reportfraud.ftc.gov/').level, 'low');
expectAtLeast('Unknown phone number', analyzePhoneNumber('321-555-0199').level, 'caution');
expectAtMost('Known Medicare number', analyzePhoneNumber('1-800-633-4227').level, 'low');

for (const answer of ['safe', 'suspicious', 'scam'] as const) {
  assert(practiceExamples.some((example) => example.answer === answer), `Practice quiz missing ${answer} answer`);
}

for (const example of practiceExamples) {
  assert(example.message.trim().length > 0, `${example.id}: missing practice message`);
  assert(example.explanation.trim().length > 0, `${example.id}: missing practice explanation`);
}

const hfSpam = createHfSpamReviewFromScores([
  { label: 'LABEL_0', score: 0.03 },
  { label: 'LABEL_1', score: 0.97 },
]);
if (!hfSpam) throw new Error('Hugging Face spam label mapping returned no review.');
assert(hfSpam?.level === 'stop', `Hugging Face spam label mapping failed: ${hfSpam?.level}`);

const hfHam = createHfSpamReviewFromScores([
  { label: 'LABEL_0', score: 0.96 },
  { label: 'LABEL_1', score: 0.04 },
]);
if (!hfHam) throw new Error('Hugging Face ham label mapping returned no review.');
assert(hfHam?.level === 'low', `Hugging Face ham label mapping failed: ${hfHam?.level}`);

const modelReview = createHfSpamReviewFromChatContent(
  JSON.stringify({
    risk_score: 100,
    verdict: 'scam',
    explanation: 'The model says the message is trying to get payment information for a prize claim.',
    reasons: ['Requests credit card details', 'Unsolicited prize claim'],
    next_steps: ['Do not reply', 'Do not provide card information'],
  }),
);
assert(modelReview.level === 'stop', `Hugging Face scam review parsing failed: ${modelReview.level}`);

const combinedReview = combineModelReviews([hfHam, modelReview]);
assert(combinedReview?.level === 'stop', `Hugging Face ensemble failed to use highest model risk: ${combinedReview?.level}`);

console.log('Scam analyzer tests passed');
