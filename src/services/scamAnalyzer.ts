import { AnalysisResult, Finding, RiskLevel } from '../types/app';

type PatternRule = {
  id: string;
  regex: RegExp;
  title: string;
  detail: string;
  points: number;
  severity: RiskLevel;
  category: Finding['category'];
};

const rules: PatternRule[] = [
  {
    id: 'urgent-action',
    regex: /\b(urgent|immediately|right now|act now|final notice|last chance|expires today|within 24 hours|do not delay|avoid suspension|avoid closure)\b/i,
    title: 'Pressure to act immediately',
    detail: 'Scammers try to stop people from slowing down, checking facts, or calling someone trusted.',
    points: 14,
    severity: 'caution',
    category: 'urgency',
  },
  {
    id: 'secrecy',
    regex: /\b(do not tell|don't tell|keep this confidential|stay on the phone|do not hang up|under investigation|no one else)\b/i,
    title: 'Secrecy request',
    detail: 'Legitimate banks, agencies, and family members do not need you to hide the conversation from trusted people.',
    points: 18,
    severity: 'high',
    category: 'secrecy',
  },
  {
    id: 'verification-code',
    regex: /\b(verification code|security code|one[- ]?time code|otp|2fa|two[- ]factor|passcode|login code|authentication code)\b/i,
    title: 'Verification code request',
    detail: 'A verification code is often the key to your account. A real company will not ask for it on an incoming call or text.',
    points: 45,
    severity: 'stop',
    category: 'identity',
  },
  {
    id: 'gift-card',
    regex: /\b(gift card|apple card|google play|steam card|target card|prepaid card|scratch off|read the numbers)\b/i,
    title: 'Gift card payment',
    detail: 'Gift cards are a favorite scam payment because the money is hard to recover once the numbers are shared.',
    points: 75,
    severity: 'stop',
    category: 'payment',
  },
  {
    id: 'crypto-wire',
    regex: /\b(crypto|cryptocurrency|bitcoin|btc|ethereum|wire transfer|western union|moneygram|bitcoin atm|crypto atm)\b/i,
    title: 'Hard-to-reverse payment',
    detail: 'Crypto, wire transfers, and payment kiosks are commonly used when scammers want money moved fast.',
    points: 55,
    severity: 'stop',
    category: 'payment',
  },
  {
    id: 'payment-app',
    regex: /\b(zelle|cash app|venmo|paypal friends|friends and family)\b/i,
    title: 'Payment app request',
    detail: 'Payment app transfers can be difficult to reverse and are risky when requested under pressure.',
    points: 18,
    severity: 'high',
    category: 'payment',
  },
  {
    id: 'safe-account',
    regex: /\b(safe account|move your money|protective account|hold your funds|transfer your balance)\b/i,
    title: 'Move money to a "safe" account',
    detail: 'Banks do not ask customers to move money to a secret safe account. This is a major banking scam pattern.',
    points: 26,
    severity: 'stop',
    category: 'money',
  },
  {
    id: 'remote-access',
    regex: /\b(remote access|screen share|anydesk|teamviewer|ultraviewer|logmein|install this app|download this app)\b/i,
    title: 'Remote access request',
    detail: 'Remote access can let a stranger see passwords, bank screens, and security codes.',
    points: 45,
    severity: 'stop',
    category: 'device',
  },
  {
    id: 'threats',
    regex: /\b(arrest|warrant|lawsuit|police will come|suspended|account closure|benefits will stop|medicare canceled|social security suspended|deportation)\b/i,
    title: 'Threats or official-sounding fear',
    detail: 'Scammers often impersonate officials and threaten punishment to make people panic.',
    points: 19,
    severity: 'high',
    category: 'threat',
  },
  {
    id: 'bank-agency-impersonation',
    regex: /\b(bank|medicare|social security|irs|amazon|microsoft|apple support|paypal|usps|fedex|sheriff|police|fbi|court)\b/i,
    title: 'Trusted organization name',
    detail: 'Scammers often borrow a real organization name. Verification should use the official number, not the incoming message.',
    points: 10,
    severity: 'caution',
    category: 'identity',
  },
  {
    id: 'family-emergency',
    regex: /\b(grandson|granddaughter|grandchild|mom|dad|bail|jail|hospital|accident|stranded|lawyer)\b/i,
    title: 'Family emergency story',
    detail: 'Grandparent scams and voice-clone scams use panic, secrecy, and family love to rush payment.',
    points: 18,
    severity: 'high',
    category: 'voice',
  },
  {
    id: 'links',
    regex: /\bhttps?:\/\/|www\.|bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly|rebrand\.ly|cutt\.ly|is\.gd/i,
    title: 'Link included',
    detail: 'Links in unexpected messages can lead to fake sign-in pages or malware. Open the official app or type the website yourself.',
    points: 13,
    severity: 'caution',
    category: 'link',
  },
  {
    id: 'callback-number',
    regex: /\b(call|text|contact|dial|phone)\b.{0,35}(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b|\b(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b.{0,35}\b(call|text|contact|dial|phone)\b/i,
    title: 'Callback number in the message',
    detail: 'A scam message may push you to call a number it provides. Use the official number from a card, statement, or official website instead.',
    points: 17,
    severity: 'high',
    category: 'identity',
  },
  {
    id: 'unexpected-charge',
    regex: /\b(charged|charge|invoice|receipt|order confirmation|purchase|transaction|payment of|subscription renewal)\b.{0,45}\$?\d{2,5}|\$?\d{2,5}.{0,45}\b(charged|charge|invoice|receipt|order confirmation|purchase|transaction|subscription renewal)\b/i,
    title: 'Unexpected charge or invoice',
    detail: 'Fake invoice scams use a large charge to make people panic and call back before checking the real account.',
    points: 18,
    severity: 'high',
    category: 'money',
  },
  {
    id: 'not-you-cancel',
    regex: /\b(if this was not you|if you did not authorize|to cancel|cancel this order|dispute this charge|refund department)\b/i,
    title: 'Cancel-or-dispute bait',
    detail: 'Scammers often say to call or click if a charge was not yours. That callback is the trap.',
    points: 16,
    severity: 'high',
    category: 'money',
  },
  {
    id: 'delivery-toll-fee',
    regex: /\b(toll|traffic ticket|redelivery|delivery fee|customs fee|package held|failed delivery|unpaid toll|parking ticket)\b/i,
    title: 'Small fee or delivery/toll claim',
    detail: 'Small fake fees are used to collect card numbers or send people to fake agency and delivery websites.',
    points: 15,
    severity: 'caution',
    category: 'money',
  },
  {
    id: 'account-verify-link',
    regex: /\b(verify your account|confirm your account|update your payment|validate your information|restore access|secure your account)\b/i,
    title: 'Account verification pressure',
    detail: 'Unexpected account verification messages can lead to fake sign-in pages that steal passwords.',
    points: 16,
    severity: 'high',
    category: 'identity',
  },
  {
    id: 'refund-recovery',
    regex: /\b(recover your money|refund agent|chargeback specialist|we can get your money back|recovery fee)\b/i,
    title: 'Recovery scam wording',
    detail: 'After someone loses money, scammers may pose as recovery experts and ask for more fees.',
    points: 21,
    severity: 'stop',
    category: 'recovery',
  },
  {
    id: 'investment-guarantee',
    regex: /\b(guaranteed returns|risk[- ]?free investment|double your money|exclusive trading|limited investment opportunity|forex|binary option)\b/i,
    title: 'Guaranteed investment promise',
    detail: 'Real investments are never guaranteed. Scammers use impressive language to hide risk and pressure.',
    points: 20,
    severity: 'high',
    category: 'money',
  },
  {
    id: 'prize-fee',
    regex: /\b(you won|winner|sweepstakes|claim your prize|processing fee|delivery fee|customs fee)\b/i,
    title: 'Prize or fee bait',
    detail: 'A real prize does not require payment, gift cards, or bank details before you receive it.',
    points: 17,
    severity: 'high',
    category: 'money',
  },
];

const defaultNextSteps = [
  'Pause before replying. Do not click links or call numbers in the message.',
  'Call the official company number from a card, statement, or official website.',
  'Ask a trusted contact to verify it with you.',
];

const stopNextSteps = [
  'Hang up or stop replying now.',
  'Do not send money, gift card numbers, crypto, or verification codes.',
  'Call your trusted contact before doing anything else.',
  'Use the official company number, not the number that contacted you.',
];

export function levelForScore(score: number): RiskLevel {
  if (score >= 75) return 'stop';
  if (score >= 50) return 'high';
  if (score >= 25) return 'caution';
  return 'low';
}

export function labelForLevel(level: RiskLevel) {
  switch (level) {
    case 'stop':
      return 'Stop and Verify';
    case 'high':
      return 'High Risk';
    case 'caution':
      return 'Caution';
    default:
      return 'Low Concern';
  }
}

export function getLevelColor(level: RiskLevel) {
  switch (level) {
    case 'stop':
      return '#B42318';
    case 'high':
      return '#C2410C';
    case 'caution':
      return '#B7791F';
    default:
      return '#0F766E';
  }
}

function uniqueFindings(items: Finding[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function boostForCombinations(findings: Finding[]) {
  const categories = new Set(findings.map((finding) => finding.category));
  let boost = 0;

  if (categories.has('secrecy') && categories.has('payment')) boost += 18;
  if (categories.has('secrecy') && categories.has('money')) boost += 12;
  if (categories.has('secrecy') && categories.has('identity')) boost += 12;
  if (categories.has('urgency') && categories.has('identity')) boost += 8;
  if (categories.has('threat') && categories.has('money')) boost += 12;
  if (categories.has('device') && categories.has('identity')) boost += 10;
  if (categories.has('voice') && categories.has('payment')) boost += 12;

  return boost;
}

export function analyzeMessage(input: string, context = 'message'): AnalysisResult {
  const text = input.trim();
  const findings = uniqueFindings(
    rules
      .filter((rule) => rule.regex.test(text))
      .map((rule) => ({
        id: rule.id,
        title: rule.title,
        detail: rule.detail,
        category: rule.category,
        points: rule.points,
        severity: rule.severity,
      })),
  );

  const rawScore = findings.reduce((total, finding) => total + finding.points, 0) + boostForCombinations(findings);
  const score = Math.max(0, Math.min(100, text.length === 0 ? 0 : rawScore));
  const level = levelForScore(score);
  const matchedTerms = rules
    .filter((rule) => rule.regex.test(text))
    .map((rule) => {
      const match = text.match(rule.regex);
      return match?.[0] ?? rule.title;
    });

  const headline = findings.length
    ? `${labelForLevel(level)}: ${findings[0].title}`
    : text
      ? 'No major pressure signs found'
      : 'Add text to run a check';

  const summary = findings.length
    ? `This ${context} has ${findings.length} warning sign${findings.length === 1 ? '' : 's'}. The concern is not one word by itself; it is the pattern of pressure, payment, identity, and verification requests.`
    : text
      ? 'I do not see the strongest scam-pressure patterns in this text. Still verify unexpected account, medical, delivery, or family emergency messages through official channels.'
      : 'Paste a message, transcript, or notes from a call to get a plain-language explanation.';

  return {
    score,
    level,
    headline,
    summary,
    findings,
    matchedTerms,
    nextSteps: level === 'stop' || level === 'high' ? stopNextSteps : defaultNextSteps,
    script:
      level === 'low'
        ? 'I will verify this through the official number before I respond.'
        : 'I am stopping now. I will call the official number myself and speak with my trusted contact first.',
  };
}

export function analyzeCallChecklist(answers: Record<string, boolean>): AnalysisResult {
  const callFindings: Finding[] = [];
  const add = (id: string, title: string, detail: string, points: number, severity: RiskLevel, category: Finding['category']) =>
    callFindings.push({ id, title, detail, points, severity, category });

  if (answers.money) add('call-money', 'They asked for money', 'Unexpected money requests under pressure are a core scam signal.', 22, 'stop', 'money');
  if (answers.secret) add('call-secret', 'They asked you not to tell anyone', 'Secrecy keeps you away from people who could help verify the story.', 24, 'stop', 'secrecy');
  if (answers.code) add('call-code', 'They asked for a verification code', 'Codes can unlock accounts. Never share them with an incoming caller.', 24, 'stop', 'identity');
  if (answers.remote) add('call-remote', 'They asked for remote access', 'Remote access can expose banking, passwords, and private records.', 24, 'stop', 'device');
  if (answers.threat) add('call-threat', 'They threatened arrest or account closure', 'Threats are meant to cause panic and bypass careful verification.', 19, 'high', 'threat');
  if (answers.callerId) add('call-spoof', 'Caller ID may be spoofed', 'Caller ID can be faked, even when it shows a familiar company or local number.', 10, 'caution', 'identity');

  const score = Math.min(100, callFindings.reduce((sum, finding) => sum + finding.points, 0) + boostForCombinations(callFindings));
  const level = levelForScore(score);

  return {
    score,
    level,
    headline: callFindings.length ? `${labelForLevel(level)} call` : 'No major call red flags selected',
    summary: callFindings.length
      ? 'The risk comes from the caller trying to control your next action. Slow down, end the call, and verify independently.'
      : 'If the call was unexpected, it is still safest to verify using an official number.',
    findings: callFindings,
    matchedTerms: callFindings.map((finding) => finding.title),
    nextSteps: level === 'low' ? defaultNextSteps : stopNextSteps,
    script: 'I do not handle money, codes, or account access on incoming calls. I am hanging up and calling the official number.',
  };
}

export function analyzeVoiceClone(answers: Record<string, boolean>, phrase?: string): AnalysisResult {
  const findings: Finding[] = [];
  const add = (id: string, title: string, detail: string, points: number, severity: RiskLevel, category: Finding['category'] = 'voice') =>
    findings.push({ id, title, detail, points, severity, category });

  if (answers.family) add('voice-family', 'They claim to be family', 'Family emergency stories are common in grandparent and voice-clone scams.', 17, 'high');
  if (answers.money) add('voice-money', 'They need money immediately', 'Urgent money requests are dangerous when identity is not verified.', 24, 'stop', 'payment');
  if (answers.secret) add('voice-secret', 'They say not to tell anyone', 'Secrecy is a stronger warning sign than the sound of the voice.', 22, 'stop', 'secrecy');
  if (answers.emotional) add('voice-emotional', 'The story is emotional or shocking', 'Shock makes it harder to notice inconsistencies.', 12, 'caution');
  if (!phrase?.trim()) add('voice-phrase', 'No verification phrase stored', 'A private family phrase gives you a fast way to verify identity.', 8, 'caution');

  const score = Math.min(100, findings.reduce((sum, finding) => sum + finding.points, 0) + boostForCombinations(findings));
  const level = levelForScore(score);

  return {
    score,
    level,
    headline: `${labelForLevel(level)} for voice-clone risk`,
    summary: 'Do not rely on the voice alone. Hang up, call the person back using a saved number, and ask for the family verification phrase.',
    findings,
    matchedTerms: findings.map((finding) => finding.title),
    nextSteps: [
      'Ask for the family verification phrase.',
      'Hang up and call the family member directly using a saved number.',
      'Call another trusted relative before sending money.',
    ],
    script: phrase?.trim()
      ? `Before I do anything, tell me our family verification phrase.`
      : 'I need to verify this with another family member before I do anything.',
  };
}

const paymentDetails: Record<string, { points: number; title: string; detail: string }> = {
  giftCard: {
    points: 28,
    title: 'Gift card',
    detail: 'Scammers ask for gift card numbers because they can drain the value quickly.',
  },
  crypto: {
    points: 28,
    title: 'Crypto',
    detail: 'Crypto transfers are usually irreversible and often appear in investment and emergency scams.',
  },
  wire: {
    points: 24,
    title: 'Wire transfer',
    detail: 'Wire transfers move money quickly and may be hard to recover.',
  },
  zelle: {
    points: 20,
    title: 'Zelle',
    detail: 'Zelle is intended for people you know and trust, not urgent requests from strangers.',
  },
  cashApp: {
    points: 20,
    title: 'Cash App',
    detail: 'Payment app transfers can be hard to reverse after a scam.',
  },
  venmo: {
    points: 18,
    title: 'Venmo',
    detail: 'Use payment apps only after independently verifying the person and purpose.',
  },
  bankCard: {
    points: 12,
    title: 'Card or bank payment',
    detail: 'Cards may have dispute protections, but unexpected payment requests still need verification.',
  },
};

export function analyzePayments(selected: Record<string, boolean>): AnalysisResult {
  const findings = Object.entries(selected)
    .filter(([, active]) => active)
    .map(([key]) => {
      const detail = paymentDetails[key];
      return {
        id: `payment-${key}`,
        title: detail.title,
        detail: detail.detail,
        points: detail.points,
        severity: detail.points >= 24 ? 'stop' : detail.points >= 18 ? 'high' : 'caution',
        category: 'payment',
      } as Finding;
    });
  const score = Math.min(100, findings.reduce((sum, finding) => sum + finding.points, 0));
  const level = levelForScore(score);

  return {
    score,
    level,
    headline: findings.length ? `${labelForLevel(level)} payment request` : 'Choose a payment method',
    summary: findings.length
      ? 'The safer move is to stop and verify the reason for payment through a trusted person or official number.'
      : 'Before sending money, choose the payment type to see why scammers may prefer it.',
    findings,
    matchedTerms: findings.map((finding) => finding.title),
    nextSteps: [
      'Do not send money while someone is pressuring you.',
      'Call your bank or trusted contact before sending payment.',
      'Use official billing portals only after typing the website yourself.',
    ],
    script: 'I do not send money under pressure. I will verify this first.',
  };
}

const shorteners = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'rebrand.ly', 'cutt.ly', 'is.gd'];
const verifiedDomains = [
  'irs.gov',
  'ssa.gov',
  'medicare.gov',
  'reportfraud.ftc.gov',
  'identitytheft.gov',
  'ic3.gov',
  'amazon.com',
  'paypal.com',
  'usps.com',
  'fedex.com',
  'ups.com',
];
const brandDomains: Record<string, string[]> = {
  amazon: ['amazon.com'],
  paypal: ['paypal.com'],
  usps: ['usps.com'],
  fedex: ['fedex.com'],
  medicare: ['medicare.gov'],
  socialsecurity: ['ssa.gov'],
  irs: ['irs.gov'],
};

function parseUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
}

export function analyzeUrl(rawUrl: string): AnalysisResult {
  const url = parseUrl(rawUrl);
  const findings: Finding[] = [];
  const add = (id: string, title: string, detail: string, points: number, severity: RiskLevel, category: Finding['category'] = 'link') =>
    findings.push({ id, title, detail, points, severity, category });

  if (!url) {
    return {
      score: rawUrl.trim() ? 30 : 0,
      level: rawUrl.trim() ? 'caution' : 'low',
      headline: rawUrl.trim() ? 'This does not look like a complete URL' : 'Paste a URL to check',
      summary: rawUrl.trim() ? 'A broken or odd link should not be opened from an unexpected message.' : 'Paste a link or scan a QR code to preview it before opening.',
      findings,
      matchedTerms: [],
      nextSteps: defaultNextSteps,
      script: 'I will type the official website myself instead of opening this link.',
    };
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const full = url.toString().toLowerCase();

  if (url.protocol !== 'https:') add('not-https', 'Not using HTTPS', 'Legitimate sign-in and payment pages should use HTTPS.', 12, 'caution');
  if (shorteners.includes(host)) add('shortener', 'Shortened link', 'Short links hide the final website until after you open them.', 18, 'high');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) add('ip-host', 'Raw IP address', 'Real companies rarely send customer links to a raw number address.', 20, 'high');
  if (host.includes('xn--')) add('punycode', 'Look-alike international domain', 'This can be used to imitate familiar brands with hidden characters.', 22, 'high');
  if (url.username || url.password) add('userinfo', 'Hidden username section', 'Links with an @ sign can disguise the real destination.', 22, 'high');
  if ((host.match(/\./g) ?? []).length >= 3) add('many-subdomains', 'Long subdomain chain', 'Long domain chains can hide the real registered site.', 12, 'caution');
  if (/%2f|%40|%3a/i.test(full)) add('encoded', 'Encoded characters', 'Encoded characters can make a link harder to read.', 10, 'caution');

  Object.entries(brandDomains).forEach(([brand, official]) => {
    if (host.includes(brand) && !official.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
      add(`brand-${brand}`, `Possible fake ${brand} domain`, `The link uses "${brand}" but does not end with ${official.join(' or ')}.`, 55, 'high');
    }
  });

  const isVerified = verifiedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  if (isVerified && findings.length === 0) {
    add('verified-domain', 'Recognized official domain', 'The domain matches a known official site. Still do not sign in from unexpected messages.', 0, 'low');
  }

  const score = Math.min(100, findings.reduce((sum, finding) => sum + finding.points, 0));
  const level = levelForScore(score);

  return {
    score,
    level,
    headline: `${labelForLevel(level)} link`,
    summary: `Destination shown before opening: ${host}. ${score >= 25 ? 'Treat this as risky until verified.' : 'No major link tricks were detected, but context still matters.'}`,
    findings,
    matchedTerms: [host],
    nextSteps: score >= 25 ? stopNextSteps : ['Open only if you expected it.', 'For banking, delivery, Medicare, or taxes, type the official website yourself.'],
    script: 'I will not open unexpected links. I will use the official website or app.',
  };
}

export function analyzePhoneNumber(phone: string): AnalysisResult {
  const cleaned = phone.replace(/[^\d+]/g, '');
  const findings: Finding[] = [];
  const add = (id: string, title: string, detail: string, points: number, severity: RiskLevel) =>
    findings.push({ id, title, detail, points, severity, category: 'identity' });

  if (!cleaned) {
    return {
      score: 0,
      level: 'low',
      headline: 'Paste a phone number to check',
      summary: 'The app will classify what can be checked locally and give verification steps.',
      findings,
      matchedTerms: [],
      nextSteps: defaultNextSteps,
      script: 'I will call the official number myself.',
    };
  }

  const verified: Record<string, string> = {
    '18773824357': 'FTC Report Fraud hotline',
    '18007721213': 'Social Security Administration main number',
    '18006334227': 'Medicare main number',
  };
  const digits = cleaned.replace(/\D/g, '');

  if (verified[digits]) {
    add('verified-phone', `Verified: ${verified[digits]}`, 'This matches a known official public number. Caller ID can still be spoofed.', 0, 'low');
  } else {
    add('unknown-phone', 'Unknown number', 'Unknown does not mean scam, but caller ID is not proof. Verify using an official source.', 25, 'caution');
  }

  if (cleaned.startsWith('+') && !cleaned.startsWith('+1')) add('international', 'International number', 'Unexpected international numbers deserve extra caution.', 18, 'high');
  if (/^(900|976)/.test(digits)) add('premium', 'Premium-rate pattern', 'Premium-rate numbers can create charges.', 18, 'high');
  if (digits.length < 10) add('short-code', 'Short code or incomplete number', 'Short codes can be legitimate, but they should not request passwords, codes, or payment.', 10, 'caution');

  const score = Math.min(100, findings.reduce((sum, finding) => sum + finding.points, 0));
  const level = levelForScore(score);

  return {
    score,
    level,
    headline: findings.some((finding) => finding.id === 'verified-phone') ? 'Business number: verified public listing' : 'Unknown number',
    summary: 'Phone lookup is limited locally. The safest proof is still calling the official number from a statement, card, or government website.',
    findings,
    matchedTerms: [cleaned],
    nextSteps: ['Do not call back numbers from pressure messages.', 'Search the organization yourself or use a printed statement.', 'Block/report repeated scam calls.'],
    script: 'I do not verify identity through caller ID. I will call the official number myself.',
  };
}
