import { Lesson, PracticeExample, ScamAlert } from '../types/app';

export const fallbackAlerts: ScamAlert[] = [
  {
    id: 'toll-texts',
    title: 'Fake toll and traffic-ticket texts',
    source: 'FTC trend',
    date: 'Current trend',
    summary: 'Unexpected toll, court, or ticket texts often use urgent language and links or QR codes. Verify through the official agency website.',
    url: 'https://consumer.ftc.gov/scams',
  },
  {
    id: 'medicare-calls',
    title: 'Fake Medicare card and benefit calls',
    source: 'Workshop alert',
    date: 'Workshop alert',
    summary: 'Scammers may ask for Medicare numbers, bank details, or fees for a new card. Medicare will not threaten benefits on an incoming call.',
    url: 'https://www.medicare.gov/basics/reporting-medicare-fraud-and-abuse',
  },
  {
    id: 'package-delivery',
    title: 'Package delivery link scams',
    source: 'FTC trend',
    date: 'Current trend',
    summary: 'Fake USPS, UPS, or FedEx texts may claim a package cannot be delivered and ask for a small fee or address confirmation.',
    url: 'https://consumer.ftc.gov/scams',
  },
  {
    id: 'voice-clone',
    title: 'Voice-clone family emergency scams',
    source: 'Workshop alert',
    date: 'Workshop alert',
    summary: 'A familiar voice is not enough proof. Hang up, call the saved number, and ask for the family verification phrase.',
    url: 'https://consumer.ftc.gov/scams',
  },
  {
    id: 'recovery-scams',
    title: 'Recovery scams after money loss',
    source: 'FTC trend',
    date: 'Current trend',
    summary: 'People claiming they can recover lost money for an upfront fee may be running a second scam.',
    url: 'https://consumer.ftc.gov/scams',
  },
];

export const lessons: Lesson[] = [
  {
    id: 'bank',
    title: 'Bank Scams',
    minutes: 1,
    summary: 'Banks do not ask you to move money to a secret safe account.',
    steps: [
      'Stop when a caller says your account is being drained.',
      'Never share verification codes or online banking passwords.',
      'Hang up and call the number on your card or bank statement.',
    ],
    remember: 'A real bank will not tell you to hide the call from family or staff.',
  },
  {
    id: 'grandparent',
    title: 'Grandparent Scams',
    minutes: 1,
    summary: 'Family emergency scams use fear, secrecy, and love.',
    steps: [
      'Ask for the family verification phrase.',
      'Call the family member back using a saved number.',
      'Check with a second relative before sending money.',
    ],
    remember: 'A panicked voice is not proof. Verification protects your family.',
  },
  {
    id: 'tech',
    title: 'Tech Support Scams',
    minutes: 1,
    summary: 'Unexpected pop-ups and callers cannot see your computer problems.',
    steps: [
      'Do not call numbers in pop-ups.',
      'Do not install remote access apps for strangers.',
      'Restart the device and call a trusted helper.',
    ],
    remember: 'Remote access gives a stranger control of your screen.',
  },
  {
    id: 'romance',
    title: 'Romance Scams',
    minutes: 1,
    summary: 'Scammers build trust slowly before asking for money.',
    steps: [
      'Be cautious if someone avoids video calls or in-person meetings.',
      'Do not send money to someone you have not met.',
      'Talk to a trusted person before any emergency payment.',
    ],
    remember: 'Real affection does not require secrecy or money transfers.',
  },
  {
    id: 'investment',
    title: 'Investment Scams',
    minutes: 1,
    summary: 'Guaranteed profits and pressure to invest now are red flags.',
    steps: [
      'Ignore guaranteed or risk-free return claims.',
      'Do not move money to crypto wallets under instruction.',
      'Verify brokers and platforms through official regulators.',
    ],
    remember: 'If profit is guaranteed, the claim is not honest.',
  },
];

export const practiceExamples: PracticeExample[] = [
  {
    id: 'amazon-charge',
    channel: 'Text message',
    message: 'Your Amazon account has been charged $799. Call 844-555-0199 immediately if this was not you.',
    answer: 'scam',
    explanation: 'It creates fear and gives you a phone number to call. Open Amazon yourself or use the official number.',
    redFlags: ['Unexpected charge', 'Urgent call request', 'Unverified phone number'],
  },
  {
    id: 'bank-code',
    channel: 'Phone call',
    message: 'This is your bank fraud department. Read me the six-digit code we just sent so I can stop the theft.',
    answer: 'scam',
    explanation: 'Do not share verification codes with an incoming caller, even if they say they are from the bank.',
    redFlags: ['Verification code request', 'Bank impersonation', 'Urgency'],
  },
  {
    id: 'pharmacy-ready',
    channel: 'Text message',
    message: 'Your prescription is ready for pickup at the pharmacy you use. No payment or code requested.',
    answer: 'safe',
    explanation: 'There is no link, payment request, threat, or request for private information. Use the pharmacy app or known number if unsure.',
    redFlags: [],
  },
  {
    id: 'new-device-alert',
    channel: 'Email',
    message: 'A new device signed in to your bank account. If this was not you, open your bank app or call the number on your card.',
    answer: 'suspicious',
    explanation: 'The warning could be real, but you should not use a link or phone number from the message. Open the bank app or use your card.',
    redFlags: ['Account warning', 'Needs separate verification'],
  },
  {
    id: 'grandchild-bail',
    channel: 'Voicemail',
    message: 'Grandma, I had an accident and I need bail money right now. Please do not tell Mom or Dad.',
    answer: 'scam',
    explanation: 'Family emergency plus secrecy plus urgent money is a high-risk pattern. Use the family verification phrase and call back using a saved number.',
    redFlags: ['Family emergency', 'Secrecy', 'Immediate money'],
  },
  {
    id: 'delivery-link',
    channel: 'Text message',
    message: 'USPS failed delivery. Pay $0.30 redelivery fee now: usps-delivery-help.example/pay',
    answer: 'scam',
    explanation: 'The domain is not the official USPS domain and the small fee is bait to collect card details.',
    redFlags: ['Fake delivery', 'Suspicious domain', 'Payment request'],
  },
  {
    id: 'clinic-callback',
    channel: 'Voicemail',
    message: 'This is Dr. Patel’s office. Please call the number on your appointment card about your Tuesday appointment.',
    answer: 'safe',
    explanation: 'It asks you to use a number you already have. There is no new link, code, or payment request.',
    redFlags: [],
  },
  {
    id: 'charity-donation',
    channel: 'Text message',
    message: 'Can you donate today for storm relief? We are collecting through Venmo. Reply if you want the handle.',
    answer: 'suspicious',
    explanation: 'It may be real, but donations should be checked through the charity website before sending money.',
    redFlags: ['Payment app', 'Unverified charity'],
  },
];

export const recoverySteps = [
  {
    title: 'If money was sent',
    items: ['Call the bank or payment company immediately.', 'Ask about freezing, reversing, or disputing the transaction.', 'Save receipts, phone numbers, screenshots, and messages.'],
  },
  {
    title: 'If a card or account was exposed',
    items: ['Freeze or replace the card.', 'Change passwords from a clean device.', 'Turn on two-factor authentication with help from a trusted person.'],
  },
  {
    title: 'If a link was clicked',
    items: ['Do not enter more information.', 'Close the page.', 'Run device updates and ask a trusted helper to check the device.'],
  },
  {
    title: 'Report and protect others',
    items: ['Report fraud to ReportFraud.ftc.gov.', 'Report internet-enabled fraud to IC3.gov.', 'Warn family and staff about recovery scams.'],
  },
];

export const emergencySteps = ['Hang up.', 'Do not click links.', 'Do not send money.', 'Do not share codes or passwords.', 'Call your trusted contact.', 'Call the official company number.'];

export const trustedContactMessage = 'I received a suspicious call or message. Can you help me verify it before I respond or send money?';
