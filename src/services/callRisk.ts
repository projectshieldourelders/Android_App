// Local-only call spoofing / scam-risk heuristics.
//
// Runs entirely on-device (no network, no cost, no data sent anywhere). It
// combines several honest signals — number patterns, neighbor-spoofing
// behaviour, known high-risk prefixes, claimed-identity mismatch, and whether
// the number was community-reported — and is explicit about uncertainty rather
// than claiming certainty.

import { CallRiskResult, RiskLevel } from '../types/app';

// A small, illustrative local list of number patterns that are commonly abused.
// This is intentionally conservative; it is a hint, not proof.
const HIGH_RISK_PREFIXES = ['+232', '+233', '+234', '+225', '+229', '+237', '+248', '+995', '+371', '+375'];
const KNOWN_REPORTED_SAMPLES = new Set(['8005551234', '18885550000']);

function digitsOnly(value: string): string {
  return value.replace(/[^\d]/g, '');
}

function levelFromScore(score: number): RiskLevel {
  if (score >= 70) return 'stop';
  if (score >= 45) return 'high';
  if (score >= 20) return 'caution';
  return 'low';
}

export interface CallRiskInput {
  number: string;
  claimedIdentity?: string;
  userAreaCode?: string; // optional: user's own area code + prefix for neighbor-spoof detection
}

export function analyzeCallRisk(input: CallRiskInput): CallRiskResult {
  const raw = input.number.trim();
  const digits = digitsOnly(raw);
  const reasons: string[] = [];
  let score = 0;
  let signalCount = 0;

  if (!digits) {
    return {
      score: 0,
      level: 'low',
      headline: 'Enter a number to check',
      summary: 'Add the phone number to run a spoofing and scam-risk check.',
      reasons: [],
      recommendation: 'Type or paste the incoming number above.',
      uncertain: false,
    };
  }

  // 1. Length / format anomalies
  if (digits.length < 7) {
    score += 20;
    signalCount += 1;
    reasons.push('The number is unusually short, which can signal a spoofed or masked caller.');
  }
  if (/[a-zA-Z]/.test(raw)) {
    score += 15;
    signalCount += 1;
    reasons.push('The caller ID contains letters instead of a normal number.');
  }

  // 2. High-risk international prefixes (common in one-ring / callback scams)
  const normalizedIntl = raw.startsWith('+') ? raw : digits.startsWith('00') ? `+${digits.slice(2)}` : '';
  if (normalizedIntl && HIGH_RISK_PREFIXES.some((prefix) => normalizedIntl.startsWith(prefix))) {
    score += 30;
    signalCount += 1;
    reasons.push('The country code is one frequently used in callback and one-ring charge scams.');
  }

  // 3. Repeated / sequential digit patterns (auto-generated numbers)
  const local = digits.slice(-10);
  if (/(\d)\1{5,}/.test(local)) {
    score += 20;
    signalCount += 1;
    reasons.push('The number repeats the same digit many times, which looks auto-generated.');
  }
  if (/0123456789|1234567890|9876543210/.test(local)) {
    score += 20;
    signalCount += 1;
    reasons.push('The digits run in a straight sequence, a common sign of a fake number.');
  }

  // 4. Neighbor spoofing — matches the user's own area code + exchange
  if (input.userAreaCode) {
    const userPrefix = digitsOnly(input.userAreaCode).slice(0, 6);
    if (userPrefix.length === 6 && local.startsWith(userPrefix)) {
      score += 25;
      signalCount += 1;
      reasons.push('The number closely matches your own area code and exchange — a classic "neighbor spoofing" trick to look local.');
    }
  }

  // 5. Claimed identity mismatch (cannot verify metadata offline → uncertain)
  if (input.claimedIdentity && input.claimedIdentity.trim()) {
    reasons.push(
      `The caller claims to be "${input.claimedIdentity.trim()}". We cannot confirm the number truly belongs to them — call the organization back on a number you already trust.`,
    );
    // small bump because identity claims + unverifiable metadata is a known lure
    score += 10;
    signalCount += 1;
  }

  // 6. Community-reported sample match
  if (KNOWN_REPORTED_SAMPLES.has(local)) {
    score += 45;
    signalCount += 1;
    reasons.push('This number matches an entry in our local list of reported scam numbers.');
  }

  const level = levelFromScore(score);
  // Uncertain when we have few signals or the score sits in an ambiguous band.
  const uncertain = signalCount === 0 || (level === 'caution' && signalCount <= 1);

  let headline: string;
  let summary: string;
  let recommendation: string;

  if (level === 'stop' || level === 'high') {
    headline = uncertain ? 'Possible scam or spoofing risk' : 'Likely scam or spoofed call';
    summary = 'Several signs suggest this call may be spoofed or part of a scam. Treat it with caution.';
    recommendation = 'Do not share money, codes, or personal details. Hang up and call back on a number you already trust.';
  } else if (level === 'caution') {
    headline = 'Worth a careful check';
    summary = 'A few signs are present, but this is not conclusive. Stay cautious.';
    recommendation = 'If they ask for money, codes, or secrecy, hang up and verify through an official number.';
  } else {
    headline = 'No strong risk signals found';
    summary = 'We did not find obvious spoofing patterns. This does not guarantee the call is safe.';
    recommendation = 'Still never share codes or payments based on an incoming call. Verify anything important independently.';
  }

  if (uncertain) {
    reasons.push('We could not confirm this with certainty — these are signals, not proof.');
  }

  return { score: Math.min(100, score), level, headline, summary, reasons, recommendation, uncertain };
}
