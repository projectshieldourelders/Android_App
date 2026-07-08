// Cost / token optimization layer for message + email checks.
//
// Goals:
//  - Run cheap local heuristics FIRST and skip the paid model when the local
//    result is already decisive.
//  - Normalize + length-cap + lightly redact text before it ever leaves the
//    device, so we send the minimum necessary and avoid leaking sensitive data.
//  - Cache results by normalized input so repeated checks cost nothing.

import { AnalysisResult, HfSpamReview } from '../types/app';

const MAX_MODEL_CHARS = 800; // cap tokens sent to any external model

/** Lowercase, trim, and collapse whitespace for stable cache keys + cheap compares. */
export function normalizeForCheck(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Reduce sensitive data before sending to an external model while preserving
 * scam signals. Masks long digit runs (card/account numbers) and email
 * addresses; keeps urgency/keyword structure intact. Also caps length.
 */
export function redactForModel(text: string): string {
  const masked = text
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[email]')
    .replace(/\b\d[\d\s-]{10,}\d\b/g, '[long-number]');
  return masked.slice(0, MAX_MODEL_CHARS);
}

/**
 * Decide whether it is worth calling the external model. We only escalate when
 * the local heuristic is genuinely uncertain AND the input is substantial
 * enough to be worth the token spend.
 */
export function shouldEscalateToModel(local: AnalysisResult, normalized: string): boolean {
  if (normalized.length < 12) return false; // too little text to be worth a call
  if (local.level === 'stop' || local.level === 'high') return false; // already decisive
  if (local.level === 'low' && local.findings.length === 0) return false; // clearly nothing
  return true; // 'caution' or weak-low → the model can add value
}

// Simple in-memory cache (keyed by normalized input). Bounded to avoid growth.
const spamCache = new Map<string, HfSpamReview>();
const MAX_CACHE = 40;

export function getCachedSpam(input: string): HfSpamReview | undefined {
  return spamCache.get(normalizeForCheck(input));
}

export function setCachedSpam(input: string, review: HfSpamReview): void {
  const key = normalizeForCheck(input);
  if (spamCache.size >= MAX_CACHE) {
    const oldest = spamCache.keys().next().value;
    if (oldest) spamCache.delete(oldest);
  }
  spamCache.set(key, review);
}

export function clearSpamCache(): void {
  spamCache.clear();
}
