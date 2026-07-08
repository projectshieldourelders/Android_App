import { Difficulty, WeeklyModule } from '../types/app';

// Weekly learning modules. Each week is a short, self-contained lesson with a
// real-world example, a plain-language explanation, and a 5-question quiz.
// Lessons unlock one week apart from the day the app was set up.

export const weeklyModules: WeeklyModule[] = [
  {
    id: 'week-1',
    week: 1,
    title: 'The one rule that stops most scams',
    minutes: 3,
    difficulty: 'beginner',
    lesson:
      'Almost every scam relies on one thing: getting you to act fast before you can think. The single most powerful habit is to slow down. If a call, message, or email creates urgency, that is your signal to pause — not to hurry.',
    keyPoints: [
      'Urgency is a warning sign, not a reason to rush.',
      'Real banks and agencies will let you call them back.',
      'It is always okay to hang up and verify.',
    ],
    example: {
      channel: 'Text message',
      message: 'URGENT: Your account will be closed in 30 minutes. Verify now: bit.ly/secure-acct',
    },
    explanation:
      'A real bank would never give you 30 minutes or send a shortened link. The countdown exists only to stop you from thinking clearly.',
    quiz: [
      {
        prompt: 'A message says you must act in 15 minutes or lose your account. What do you do first?',
        options: ['Click the link quickly to be safe', 'Stop and call the company on a number you trust', 'Reply asking for more time'],
        answerIndex: 1,
        whyCorrect: 'Slowing down and verifying through a trusted number defeats the urgency trick.',
      },
      {
        prompt: 'A message makes you feel panicked and rushed. That usually means:',
        options: ['It is important and real', 'It may be a scam trying to rush you', 'You should act right away'],
        answerIndex: 1,
        whyCorrect: 'Panic and pressure are exactly what scammers create to stop you thinking clearly.',
      },
      {
        prompt: 'When there is a real problem, a genuine bank will:',
        options: ['Demand instant payment', 'Let you call them back on the official number', 'Threaten to arrest you'],
        answerIndex: 1,
        whyCorrect: 'Real institutions are patient and let you verify. Threats and deadlines are scam tactics.',
      },
      {
        prompt: 'Which of these is the biggest red flag?',
        options: ['A friendly greeting', 'A countdown timer pushing you to act now', 'A phone number in the message'],
        answerIndex: 1,
        whyCorrect: 'A countdown exists only to rush you past your judgment.',
      },
      {
        prompt: 'The safest habit when anything feels urgent is to:',
        options: ['Act immediately', 'Pause, then verify independently', 'Forward it to friends'],
        answerIndex: 1,
        whyCorrect: 'Pause and verify — that single habit stops most scams.',
      },
    ],
    remember: 'Urgency is the scam. Slow down and verify.',
  },
  {
    id: 'week-2',
    week: 2,
    title: 'Spotting fake links',
    minutes: 4,
    difficulty: 'beginner',
    lesson:
      'Scam links often look almost right. They add extra words, misspell a brand, or hide the real address behind a shortener. Before tapping any link, read it slowly and ask whether you were expecting it.',
    keyPoints: [
      'Look for misspellings like "paypa1" or "amaz0n".',
      'Shortened links (bit.ly, tinyurl) hide the real destination.',
      'The real company name should come right before ".com".',
    ],
    example: {
      channel: 'Email',
      message: 'Your delivery is on hold. Update your address: http://usps-delivery-track.info/verify',
    },
    explanation:
      'The real USPS site ends in usps.com. Here the real domain is "usps-delivery-track.info" — a look-alike that has nothing to do with USPS.',
    quiz: [
      {
        prompt: 'Which web address most likely belongs to the real Amazon?',
        options: ['amazon.com', 'amazon.secure-login.net', 'amaz0n-account.com'],
        answerIndex: 0,
        whyCorrect: 'The genuine brand name sits directly before ".com". The others bury or misspell it.',
      },
      {
        prompt: 'A shortened link like bit.ly/xy7 is risky because:',
        options: ['It loads faster', 'It hides the real destination', 'It is always safe'],
        answerIndex: 1,
        whyCorrect: 'Shorteners hide where the link truly goes, so you cannot check it first.',
      },
      {
        prompt: 'Which looks like a fake bank website?',
        options: ['chase.com', 'chase-secure-login.info', 'chase.com/login'],
        answerIndex: 1,
        whyCorrect: 'The real name should sit right before ".com". "chase-secure-login.info" is a look-alike.',
      },
      {
        prompt: '"paypa1.com" is suspicious because:',
        options: ['It uses the number 1 to imitate PayPal', 'It is too short', 'PayPal has no website'],
        answerIndex: 0,
        whyCorrect: 'Swapping letters for look-alike numbers is a common trick to fake a trusted name.',
      },
      {
        prompt: 'Before tapping any link, you should:',
        options: ['Tap quickly to see what it is', 'Check the real name is before ".com" and that you expected it', 'Forward it to friends first'],
        answerIndex: 1,
        whyCorrect: 'Reading the address and confirming you expected it prevents most link scams.',
      },
    ],
    remember: 'Read the address before you tap. The real name sits right before ".com".',
  },
  {
    id: 'week-3',
    week: 3,
    title: 'Phone calls and caller ID',
    minutes: 4,
    difficulty: 'beginner',
    lesson:
      'Caller ID can be faked. Scammers can make your phone show a bank name, a government agency, or even a local number. Never trust a call just because the name looks familiar.',
    keyPoints: [
      'Caller ID is easy to spoof — it is not proof.',
      '"Neighbor spoofing" copies your area code to look local.',
      'Hang up and call back on a number you look up yourself.',
    ],
    example: {
      channel: 'Phone call',
      message: '"This is your bank\'s fraud department. We need your one-time code to stop a charge."',
    },
    explanation:
      'Banks never ask you to read back a one-time code. That code is exactly what the scammer needs to break into your account.',
    quiz: [
      {
        prompt: 'A caller claiming to be your bank asks for the code they just texted you. You should:',
        options: ['Read them the code so they can help', 'Never share it; hang up and call the bank directly', 'Text the code instead of saying it'],
        answerIndex: 1,
        whyCorrect: 'One-time codes are for you alone. Anyone asking for one is trying to get into your account.',
      },
      {
        prompt: 'Your phone shows your bank\'s name on an incoming call. Does that prove it is real?',
        options: ['Yes, caller ID is reliable', 'No, caller ID can be faked', 'Only during the day'],
        answerIndex: 1,
        whyCorrect: 'Caller ID is easily spoofed and is never proof of who is really calling.',
      },
      {
        prompt: '"Neighbor spoofing" means:',
        options: ['A neighbor is calling you', 'A scammer copies your area code to look local', 'A simple wrong number'],
        answerIndex: 1,
        whyCorrect: 'Matching your area code makes the call look local and trustworthy — but it is a trick.',
      },
      {
        prompt: 'A one-time security code should be shared with:',
        options: ['The caller who asked for it', 'No one — it is only for you', 'Family members only'],
        answerIndex: 1,
        whyCorrect: 'A one-time code is for you alone. No legitimate caller will ever need it.',
      },
      {
        prompt: 'The safest way to reach your bank is to call:',
        options: ['The number the caller gave you', 'The number on your card or statement', 'Any number you find quickly online'],
        answerIndex: 1,
        whyCorrect: 'The number on your card or statement is verified. Numbers given by callers can be fake.',
      },
    ],
    remember: 'Never share a one-time code. Caller ID is not proof.',
  },
  {
    id: 'week-4',
    week: 4,
    title: 'How scammers ask to be paid',
    minutes: 4,
    difficulty: 'intermediate',
    lesson:
      'The payment method is a huge clue. Scammers prefer methods that are hard to reverse: gift cards, wire transfers, crypto, and payment apps sent to strangers. Legitimate businesses rarely, if ever, demand these.',
    keyPoints: [
      'Gift cards are never a real way to pay a bill or fine.',
      'Wire transfers and crypto are almost impossible to get back.',
      'Being told exactly how to pay is a red flag.',
    ],
    example: {
      channel: 'Phone call',
      message: '"To keep your utilities on, pay the overdue balance today with gift cards from the nearest store."',
    },
    explanation:
      'No real utility company accepts gift cards. The demand for a specific, irreversible payment method gives the scam away.',
    quiz: [
      {
        prompt: 'Someone official-sounding says you can only settle a debt using gift cards. This is:',
        options: ['Normal for government payments', 'A clear sign of a scam', 'Fine if the amount is small'],
        answerIndex: 1,
        whyCorrect: 'No legitimate agency or company collects payment in gift cards. It is always a scam.',
      },
      {
        prompt: 'Which payment is hardest to get back if it turns out to be a scam?',
        options: ['A credit card payment', 'A wire transfer or crypto', 'Cash paid in person at your bank'],
        answerIndex: 1,
        whyCorrect: 'Wires and crypto are fast and nearly impossible to reverse — scammers prefer them.',
      },
      {
        prompt: 'Being told exactly how to pay ("only this app, only this card") is:',
        options: ['Helpful customer service', 'A red flag', 'Required by law'],
        answerIndex: 1,
        whyCorrect: 'Controlling the payment method is a scammer tactic to make refunds impossible.',
      },
      {
        prompt: 'A "government agency" demands payment in gift cards. You should:',
        options: ['Pay to avoid trouble', 'Hang up — it is a scam', 'Pay a small amount first'],
        answerIndex: 1,
        whyCorrect: 'Government agencies never take gift cards. Hang up and do not pay.',
      },
      {
        prompt: 'Someone pressures you to buy gift cards and read the numbers over the phone. You should:',
        options: ['Do it to avoid a penalty', 'Hang up — this is a scam', 'Buy just one small card'],
        answerIndex: 1,
        whyCorrect: 'Reading gift card numbers aloud hands over the money instantly. Always refuse.',
      },
    ],
    remember: 'Gift cards, wires, and crypto to strangers mean scam.',
  },
  {
    id: 'week-5',
    week: 5,
    title: 'The "family emergency" call',
    minutes: 5,
    difficulty: 'intermediate',
    lesson:
      'A frightening call claims a grandchild or relative is in trouble and needs money now. Scammers now use AI to copy voices. The emotion is designed to override your judgment.',
    keyPoints: [
      'Voices can be faked with a few seconds of audio.',
      'Agree on a private family code word in advance.',
      'Hang up and call the relative directly to confirm.',
    ],
    example: {
      channel: 'Phone call',
      message: '"Grandma, it\'s me — I\'m in jail and need bail money. Please don\'t tell mom and dad."',
    },
    explanation:
      'The secrecy plus urgency plus money is the classic pattern. Calling your relative back directly instantly breaks the illusion.',
    quiz: [
      {
        prompt: 'A caller sounds like your grandchild, needs money fast, and says keep it secret. The safest move is:',
        options: ['Send money quietly to protect them', 'Hang up and call your grandchild on their real number', 'Ask a security question on this call'],
        answerIndex: 1,
        whyCorrect: 'Verifying on a known number defeats a spoofed or AI-cloned voice.',
      },
      {
        prompt: 'Modern AI tools can:',
        options: ['Copy a person\'s voice from a short clip', 'Never copy real voices', 'Only copy written text'],
        answerIndex: 0,
        whyCorrect: 'A short audio clip is enough to fake a familiar voice, so a voice alone is not proof.',
      },
      {
        prompt: 'The best protection against a fake-voice emergency call is:',
        options: ['A private family code word', 'Sending money quickly', 'Trusting the voice you hear'],
        answerIndex: 0,
        whyCorrect: 'A pre-agreed code word instantly reveals whether the caller is really family.',
      },
      {
        prompt: '"Don\'t tell mom and dad" is a sign of:',
        options: ['A caring relative', 'A manipulation tactic', 'A wrong number'],
        answerIndex: 1,
        whyCorrect: 'Demanding secrecy keeps you from checking with others who would spot the scam.',
      },
      {
        prompt: 'When an emergency call demands secrecy and money now, you should:',
        options: ['Wire the money right away', 'Hang up and call the relative directly', 'Keep it secret as asked'],
        answerIndex: 1,
        whyCorrect: 'Calling the relative directly on a known number confirms the truth in seconds.',
      },
    ],
    remember: 'Secret + urgent + money = stop. Call your family back directly.',
  },
  {
    id: 'week-6',
    week: 6,
    title: 'Phishing and impersonation emails',
    minutes: 5,
    difficulty: 'intermediate',
    lesson:
      'Phishing emails imitate companies you trust to steal logins or money. They often mismatch the sender address, use generic greetings, and push you toward a login page that is actually fake.',
    keyPoints: [
      'Check the sender\'s full email address, not just the name.',
      'Hover or long-press a link to preview where it really goes.',
      'Log in by typing the site yourself, never through the email link.',
    ],
    example: {
      channel: 'Email',
      message: 'From: security@paypal-support-team.com — "Unusual login detected. Confirm your identity here."',
    },
    explanation:
      'PayPal emails come from paypal.com, not "paypal-support-team.com". The fear of a break-in is used to rush you onto a fake login page.',
    quiz: [
      {
        prompt: 'An email about your account comes from "service@apple-verify.net". The biggest red flag is:',
        options: ['It mentions your account', 'The sender domain is not apple.com', 'It contains a link'],
        answerIndex: 1,
        whyCorrect: 'The mismatched sender domain reveals impersonation. Real Apple mail comes from apple.com.',
      },
      {
        prompt: 'To check who really sent an email, you look at:',
        options: ['The display name', 'The full email address and its domain', 'The company logo'],
        answerIndex: 1,
        whyCorrect: 'Names and logos are easy to fake; the domain after the "@" is what matters.',
      },
      {
        prompt: 'After an email warns of a problem, the safest way to log in is to:',
        options: ['Click the link in the email', 'Type the website address yourself', 'Reply with your password'],
        answerIndex: 1,
        whyCorrect: 'Typing the address yourself avoids fake login pages linked in phishing emails.',
      },
      {
        prompt: 'A generic greeting like "Dear Customer" plus urgency is:',
        options: ['Completely normal', 'A common phishing sign', 'Proof the email is real'],
        answerIndex: 1,
        whyCorrect: 'Real companies usually know your name; generic greetings plus pressure signal phishing.',
      },
      {
        prompt: 'You should never send your password by:',
        options: ['Email or a reply message', 'Typing it on the official site', 'Keeping it to yourself'],
        answerIndex: 0,
        whyCorrect: 'Legitimate companies never ask for your password by email. Never reply with it.',
      },
    ],
    remember: 'Check the real sender address. Type the site yourself to log in.',
  },
  {
    id: 'week-7',
    week: 7,
    title: 'Romance and long-game scams',
    minutes: 6,
    difficulty: 'advanced',
    lesson:
      'Some scams build trust over weeks or months — a new online friend or partner who eventually needs money for an emergency, travel, or a "guaranteed" investment. They avoid video calls and always have a reason they cannot meet.',
    keyPoints: [
      'Refusing video calls or in-person meetings is a warning sign.',
      'Any request for money, gift cards, or crypto is the turning point.',
      '"Investment" tips from online friends are a common trap.',
    ],
    example: {
      channel: 'Message',
      message: '"I\'ve never felt this close to anyone. I just need help with a customs fee to finally visit you."',
    },
    explanation:
      'The emotional bond is the setup; the money request is the scam. A genuine relationship does not begin with a wire transfer.',
    quiz: [
      {
        prompt: 'An online partner you have never met asks for money for a plane ticket. You should:',
        options: ['Send a small amount to show you care', 'Decline and treat it as a likely scam', 'Offer to pay them back later'],
        answerIndex: 1,
        whyCorrect: 'Requests for money from someone you have never met in person are a hallmark of romance scams.',
      },
      {
        prompt: 'A warning sign in an online relationship is when they:',
        options: ['Always avoid video calls and meeting', 'Text you often', 'Like your photos'],
        answerIndex: 0,
        whyCorrect: 'Constantly avoiding video or meeting in person suggests they are not who they claim.',
      },
      {
        prompt: 'The turning point in a romance scam is usually:',
        options: ['A request for money, gift cards, or crypto', 'A kind compliment', 'A shared hobby'],
        answerIndex: 0,
        whyCorrect: 'The relationship is built only to reach the money request.',
      },
      {
        prompt: 'An online friend shares a "guaranteed" investment tip. You should:',
        options: ['Invest quickly before it closes', 'Be very cautious — it is a common trap', 'Tell everyone you know'],
        answerIndex: 1,
        whyCorrect: 'Investment tips from online-only contacts are a frequent scam setup.',
      },
      {
        prompt: 'Sending money to someone you have never met in person is something you should:',
        options: ['Do if you feel close to them', 'Not do', 'Do in small amounts'],
        answerIndex: 1,
        whyCorrect: 'If you have never met in person, do not send money — it is the core of the scam.',
      },
    ],
    remember: 'Never send money to someone you have not met in person.',
  },
  {
    id: 'week-8',
    week: 8,
    title: 'Investment and "act now" offers',
    minutes: 6,
    difficulty: 'advanced',
    lesson:
      'Investment scams promise high returns with little or no risk and pressure you to move fast before a "window closes". Real investing never guarantees profits, and legitimate advisors do not rush you.',
    keyPoints: [
      'Guaranteed high returns with no risk do not exist.',
      'Pressure to act before a deadline is a manipulation tactic.',
      'Verify anyone offering investments through official regulators.',
    ],
    example: {
      channel: 'Message',
      message: '"Our crypto fund returns 20% weekly, guaranteed. Deposit today — only 3 spots left."',
    },
    explanation:
      'Guaranteed weekly returns and artificial scarcity are impossible-to-keep promises used to pull money in quickly.',
    quiz: [
      {
        prompt: 'An "advisor" guarantees 20% weekly returns if you invest immediately. This is:',
        options: ['A rare good opportunity', 'A scam — guaranteed high returns are not real', 'Worth a small test amount'],
        answerIndex: 1,
        whyCorrect: 'No legitimate investment guarantees returns like this. Urgency plus guarantees equals fraud.',
      },
      {
        prompt: '"Guaranteed high returns with no risk" is:',
        options: ['A great deal', 'Not possible — a scam sign', 'Normal for crypto'],
        answerIndex: 1,
        whyCorrect: 'All real investments carry risk. A no-risk guarantee is a lie used to lure you in.',
      },
      {
        prompt: '"Only 3 spots left, act now" is an example of:',
        options: ['Helpful information', 'Artificial urgency and scarcity', 'A normal discount'],
        answerIndex: 1,
        whyCorrect: 'Fake scarcity pressures you to skip careful thinking.',
      },
      {
        prompt: 'Legitimate financial advisors usually:',
        options: ['Rush you to decide today', 'Let you take your time and verify them', 'Guarantee profits'],
        answerIndex: 1,
        whyCorrect: 'Real professionals welcome checks and never rush or guarantee returns.',
      },
      {
        prompt: 'Before investing with someone you met online, you should:',
        options: ['Send money quickly', 'Verify them with official regulators', 'Trust their screenshots of profits'],
        answerIndex: 1,
        whyCorrect: 'Verifying through official regulators is the only reliable check. Screenshots are easily faked.',
      },
    ],
    remember: 'Guaranteed returns + urgency = scam. Real investing has risk and no rush.',
  },
];

const difficultyRank: Record<Difficulty, number> = { beginner: 0, intermediate: 1, advanced: 2 };

/** Modules at or below the learner's chosen difficulty, in week order. */
export function modulesForDifficulty(difficulty: Difficulty): WeeklyModule[] {
  const max = difficultyRank[difficulty];
  return weeklyModules.filter((module) => difficultyRank[module.difficulty] <= max);
}

export function moduleByWeek(week: number): WeeklyModule | undefined {
  return weeklyModules.find((module) => module.week === week);
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** The date a given week unlocks, based on when the app was set up. */
export function weekUnlockDate(createdAtIso: string, week: number): Date {
  const start = new Date(createdAtIso);
  const base = Number.isNaN(start.getTime()) ? new Date() : start;
  return new Date(base.getTime() + (week - 1) * WEEK_MS);
}

export function isWeekUnlocked(createdAtIso: string, week: number, now: Date = new Date()): boolean {
  return now.getTime() >= weekUnlockDate(createdAtIso, week).getTime();
}

/** Whole days remaining until a week unlocks (0 if already unlocked). */
export function daysUntilUnlock(createdAtIso: string, week: number, now: Date = new Date()): number {
  const diff = weekUnlockDate(createdAtIso, week).getTime() - now.getTime();
  return diff <= 0 ? 0 : Math.ceil(diff / (24 * 60 * 60 * 1000));
}
