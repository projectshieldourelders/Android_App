// Light, senior-friendly games that reinforce scam-safety vocabulary and
// judgment. Kept short, calm, and forgiving — no timers, no punishment.

// ---------------------------------------------------------------------------
// Word Scramble
// ---------------------------------------------------------------------------

export interface ScrambleWord {
  word: string;
  hint: string;
}

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

// ---------------------------------------------------------------------------
// Match the Term
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Crossword (a small 5x5 scam-safety puzzle)
// ---------------------------------------------------------------------------

export interface CrosswordClue {
  number: number;
  direction: 'across' | 'down';
  clue: string;
  answer: string;
  row: number;
  col: number;
}

export const crosswordSize = 5;

export const crosswordClues: CrosswordClue[] = [
  { number: 1, direction: 'across', clue: 'A trick to steal your money or information', answer: 'SCAM', row: 0, col: 0 },
  { number: 1, direction: 'down', clue: 'Not risky — the opposite of dangerous', answer: 'SAFE', row: 0, col: 0 },
  { number: 2, direction: 'down', clue: 'A warning signal to pay attention to', answer: 'ALARM', row: 0, col: 2 },
  { number: 3, direction: 'across', clue: 'Deception for money; another word for a scam', answer: 'FRAUD', row: 2, col: 0 },
];

// ---------------------------------------------------------------------------
// True or False
// ---------------------------------------------------------------------------

export interface TrueFalseItem {
  statement: string;
  answer: boolean;
  why: string;
}

export const trueFalseItems: TrueFalseItem[] = [
  { statement: 'A real bank will ask you to read back a one-time code.', answer: false, why: 'Banks never ask for one-time codes. Anyone who does is a scammer.' },
  { statement: 'Caller ID can be faked to show any name or number.', answer: true, why: 'Scammers can "spoof" caller ID, so it is never proof of who is calling.' },
  { statement: 'Paying a bill with gift cards is safe and normal.', answer: false, why: 'No real company takes gift cards for bills. It is always a scam.' },
  { statement: 'If a message rushes you, that is a reason to slow down.', answer: true, why: 'Urgency is a scam tactic — pausing to check defeats it.' },
  { statement: 'It is fine to let an unexpected "tech" caller control your computer.', answer: false, why: 'Never give remote access to someone who called you.' },
  { statement: 'You can always hang up and call back on an official number.', answer: true, why: 'Verifying on a trusted number is your strongest protection.' },
  { statement: 'Guaranteed high investment returns with no risk are real.', answer: false, why: 'Guaranteed returns are a classic investment-scam lie.' },
  { statement: 'A shortened link hides where it truly goes.', answer: true, why: 'You cannot see the real destination, so treat it with caution.' },
];

// ---------------------------------------------------------------------------
// Fill in the Blank
// ---------------------------------------------------------------------------

export interface FillBlankItem {
  before: string;
  after: string;
  answer: string;
  options: string[];
}

export const fillBlankItems: FillBlankItem[] = [
  { before: 'Never share your', after: 'with someone who calls you.', answer: 'password', options: ['password', 'weather', 'hobby'] },
  { before: 'A feeling of', after: 'is a common scam warning sign.', answer: 'urgency', options: ['calm', 'urgency', 'boredom'] },
  { before: 'Before you tap a link, check the', after: 'carefully.', answer: 'address', options: ['address', 'color', 'font'] },
  { before: 'Scammers love', after: 'because they are hard to get back.', answer: 'gift cards', options: ['gift cards', 'checks', 'coupons'] },
  { before: 'If unsure, call the', after: 'number from your card.', answer: 'official', options: ['official', 'random', 'texted'] },
  { before: 'A one-time', after: 'is private — never read it to a caller.', answer: 'code', options: ['code', 'joke', 'story'] },
];

// ---------------------------------------------------------------------------
// Red Flag Rush (safe vs scam, quick rounds)
// ---------------------------------------------------------------------------

export interface RedFlagItem {
  text: string;
  scam: boolean;
}

export const redFlagItems: RedFlagItem[] = [
  { text: '"Pay a $2 delivery fee at this link or lose your package."', scam: true },
  { text: 'Your grandson calls and you both know the family code word.', scam: false },
  { text: '"This is the IRS. Pay now with gift cards or face arrest."', scam: true },
  { text: 'You open your bank\'s app yourself to check a charge.', scam: false },
  { text: '"You won a prize! Just send $50 to release it."', scam: true },
  { text: 'A neighbor you know knocks to say hello.', scam: false },
  { text: '"Confirm your password now to keep your account open."', scam: true },
  { text: 'You call the number printed on the back of your card.', scam: false },
  { text: '"I love you — please wire money for my plane ticket."', scam: true },
  { text: 'A store emails a receipt for something you really bought.', scam: false },
];

// ---------------------------------------------------------------------------
// Memory Match (flip cards to find pairs)
// ---------------------------------------------------------------------------

export const memoryTerms: string[] = ['Scam', 'Phishing', 'Spoofing', 'Urgency', 'Gift card', 'Verify'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fisher–Yates shuffle that returns a new array. */
export function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const key = (row: number, col: number) => `${row},${col}`;

/** Build the letter solution map + cell numbering for the crossword. */
export function buildCrossword() {
  const solution: Record<string, string> = {};
  const numberAt: Record<string, number> = {};
  const cellsForClue: Record<string, string[]> = {};

  for (const clue of crosswordClues) {
    const cells: string[] = [];
    for (let i = 0; i < clue.answer.length; i++) {
      const r = clue.direction === 'down' ? clue.row + i : clue.row;
      const c = clue.direction === 'across' ? clue.col + i : clue.col;
      const k = key(r, c);
      solution[k] = clue.answer[i];
      cells.push(k);
    }
    numberAt[key(clue.row, clue.col)] = clue.number;
    cellsForClue[`${clue.number}-${clue.direction}`] = cells;
  }
  return { solution, numberAt, cellsForClue };
}
