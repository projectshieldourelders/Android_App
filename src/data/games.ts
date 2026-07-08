// Light, senior-friendly word games that reinforce scam vocabulary.

export interface ScrambleWord {
  word: string;
  hint: string;
}

// Short, common scam-safety terms. Kept to single words so they are easy to
// unscramble by tapping letters.
export const scrambleWords: ScrambleWord[] = [
  { word: 'SCAM', hint: 'A trick to steal your money or information.' },
  { word: 'PHISHING', hint: 'Fake messages that fish for your passwords or card details.' },
  { word: 'URGENCY', hint: 'The rushed pressure scammers create so you cannot think.' },
  { word: 'SPOOFING', hint: 'Faking a caller ID or sender to look trusted.' },
  { word: 'PASSWORD', hint: 'A secret you should never share with a caller.' },
  { word: 'VERIFY', hint: 'To double-check something through an official source.' },
  { word: 'REFUND', hint: 'Money "returned" — a common excuse in recovery scams.' },
  { word: 'REMOTE', hint: 'The kind of access you should never give a stranger.' },
];

export interface MatchPair {
  term: string;
  meaning: string;
}

export const matchPairs: MatchPair[] = [
  { term: 'Phishing', meaning: 'Fake messages that try to steal your details' },
  { term: 'Spoofing', meaning: 'Faking a caller ID or email to look real' },
  { term: 'One-time code', meaning: 'A private number no caller should ask for' },
  { term: 'Gift card scam', meaning: 'Being told to pay a bill with store cards' },
  { term: 'Recovery scam', meaning: 'A fee to "get back" money you already lost' },
  { term: 'Remote access', meaning: 'Letting a stranger control your device' },
];

/** Fisher–Yates shuffle that returns a new array. */
export function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
