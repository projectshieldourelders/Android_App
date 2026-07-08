import { Difficulty, WeeklyModule } from '../types/app';

// Weekly learning modules. Each week is a short, self-contained lesson with a
// real-world example, a plain-language explanation, and a single practice
// question. Content is ordered from foundational to more advanced so it can be
// filtered by the learner's chosen difficulty.

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
    quiz: {
      prompt: 'A message says you must act in the next 15 minutes or lose your account. What should you do first?',
      options: ['Click the link quickly to be safe', 'Stop and call the company on a number you already trust', 'Reply asking for more time'],
      answerIndex: 1,
      whyCorrect: 'Slowing down and verifying through a trusted number defeats the urgency trick almost every time.',
    },
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
    quiz: {
      prompt: 'Which web address most likely belongs to the real Amazon?',
      options: ['amazon.com', 'amazon.secure-login.net', 'amaz0n-account.com'],
      answerIndex: 0,
      whyCorrect: 'The genuine brand name sits directly before ".com". The others bury or misspell it.',
    },
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
    quiz: {
      prompt: 'A caller claiming to be your bank asks for the code they just texted you. What should you do?',
      options: ['Read them the code so they can help', 'Never share the code; hang up and call the bank directly', 'Text the code instead of saying it'],
      answerIndex: 1,
      whyCorrect: 'One-time codes are for you alone. Anyone asking for one is trying to get into your account.',
    },
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
    quiz: {
      prompt: 'Someone official-sounding says you can only settle a debt using gift cards. This is:',
      options: ['Normal for government payments', 'A clear sign of a scam', 'Fine if the amount is small'],
      answerIndex: 1,
      whyCorrect: 'No legitimate agency or company collects payment in gift cards. It is always a scam.',
    },
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
    quiz: {
      prompt: 'A caller sounds like your grandchild, needs money fast, and says keep it secret. The safest move is:',
      options: ['Send money quietly to protect them', 'Hang up and call your grandchild on their real number', 'Ask them a security question over this call'],
      answerIndex: 1,
      whyCorrect: 'Verifying on a known number defeats a spoofed or AI-cloned voice. Secrecy is a manipulation tactic.',
    },
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
    quiz: {
      prompt: 'An email about your account comes from "service@apple-verify.net". What is the biggest red flag?',
      options: ['It mentions your account', 'The sender domain is not apple.com', 'It has a link'],
      answerIndex: 1,
      whyCorrect: 'The mismatched sender domain reveals impersonation. Real Apple mail comes from apple.com.',
    },
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
    quiz: {
      prompt: 'An online partner you have never met in person asks for money for a plane ticket. You should:',
      options: ['Send a small amount to show you care', 'Decline and treat it as a likely scam', 'Ask them to pay you back later'],
      answerIndex: 1,
      whyCorrect: 'Requests for money from someone you have never met in person are a hallmark of romance scams.',
    },
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
    quiz: {
      prompt: 'An "advisor" guarantees 20% weekly returns if you invest immediately. This is:',
      options: ['A rare good opportunity', 'A scam — guaranteed high returns are not real', 'Worth a small test amount'],
      answerIndex: 1,
      whyCorrect: 'No legitimate investment guarantees returns like this. Urgency plus guarantees equals fraud.',
    },
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
