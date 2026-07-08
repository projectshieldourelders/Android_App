import { HfSpamReview, RiskLevel } from '../types/app';

const HF_API_KEY = process.env.EXPO_PUBLIC_HUGGINGFACE_API_KEY;
const HF_MODEL = process.env.EXPO_PUBLIC_HUGGINGFACE_MODEL ?? 'mrm8488/bert-tiny-finetuned-sms-spam-detection';
const HF_CLASSIFIER_MODELS = (
  process.env.EXPO_PUBLIC_HUGGINGFACE_CLASSIFIER_MODELS ??
  HF_MODEL
)
  .split(',')
  .map((model: string) => model.trim())
  .filter(Boolean);
const HF_SCAM_REVIEW_MODEL = process.env.EXPO_PUBLIC_HUGGINGFACE_SCAM_REVIEW_MODEL ?? 'google/gemma-4-31B-it:cerebras';
const HF_CLASSIFIER_URL = 'https://router.huggingface.co/hf-inference/models';
const HF_CHAT_URL = 'https://router.huggingface.co/v1/chat/completions';

type HfClassification = {
  label: string;
  score: number;
};

type ModelReview = HfSpamReview & {
  source: string;
};

export function isHfSpamCheckConfigured() {
  return Boolean(HF_API_KEY && (HF_CLASSIFIER_MODELS.length || HF_SCAM_REVIEW_MODEL));
}

function flattenScores(value: unknown): HfClassification[] {
  if (!Array.isArray(value)) return [];
  const first = value[0];

  if (Array.isArray(first)) return flattenScores(first);

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const label = String((item as Record<string, unknown>).label ?? '').trim();
      const score = Number((item as Record<string, unknown>).score);
      if (!label || Number.isNaN(score)) return null;
      return { label, score };
    })
    .filter(Boolean) as HfClassification[];
}

function isSpamLabel(label: string) {
  const normalized = label.toLowerCase();
  return normalized.includes('spam') || normalized === 'label_1' || normalized === '1';
}

function isHamLabel(label: string) {
  const normalized = label.toLowerCase();
  return normalized.includes('ham') || normalized.includes('not_spam') || normalized === 'label_0' || normalized === '0';
}

function levelForSpamProbability(probability: number): RiskLevel {
  if (probability >= 0.9) return 'stop';
  if (probability >= 0.72) return 'high';
  if (probability >= 0.45) return 'caution';
  return 'low';
}

function labelForProbability(probability: number) {
  if (probability >= 0.9) return 'Very likely spam';
  if (probability >= 0.72) return 'Likely spam';
  if (probability >= 0.45) return 'Check first';
  return 'Looks okay';
}

function summarize(probability: number) {
  if (probability >= 0.72) {
    return 'The model marked this message as risky.';
  }

  if (probability >= 0.45) {
    return 'The model is unsure. Treat this as something to verify before replying.';
  }

  return 'The model did not strongly flag this text.';
}

function reviewFromProbability(probability: number, topLabel: string, source = 'SMS classifier'): ModelReview {
  const score = Math.round(probability * 100);
  const level = levelForSpamProbability(probability);

  return {
    source,
    score,
    level,
    label: topLabel,
    headline: labelForProbability(probability),
    summary: summarize(probability),
    reasons:
      probability >= 0.45
        ? ['This text matches patterns from SMS spam training data.']
        : ['This text did not strongly match the SMS spam examples.'],
    nextSteps:
      probability >= 0.45
        ? ['Do not reply yet.', 'Do not click links or call numbers from the message.', 'Use an official number or a trusted person.']
        : ['Still verify unexpected messages.', 'Use official apps or known numbers for accounts and deliveries.'],
  };
}

export function createHfSpamReviewFromScores(scores: HfClassification[]) {
  if (!scores.length) return null;

  const top = [...scores].sort((left, right) => right.score - left.score)[0];
  const spam = scores.find((item) => isSpamLabel(item.label));
  if (spam) return reviewFromProbability(spam.score, top.label);

  const ham = scores.find((item) => isHamLabel(item.label));
  if (ham) return reviewFromProbability(1 - ham.score, top.label);

  return reviewFromProbability(isSpamLabel(top.label) ? top.score : top.score >= 0.5 ? top.score : 1 - top.score, top.label);
}

function asArray(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function extractJsonObject(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('The scam review model returned an unreadable result.');
  return JSON.parse(match[0]) as Record<string, unknown>;
}

function clampScore(score: number) {
  if (Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreFromVerdict(verdict: string) {
  const normalized = verdict.toLowerCase();
  if (normalized === 'scam') return 95;
  if (normalized === 'suspicious') return 65;
  return 10;
}

function levelFromScore(score: number) {
  return levelForSpamProbability(score / 100);
}

function headlineFromScoreAndVerdict(score: number, verdict: string) {
  const normalized = verdict.toLowerCase();
  if (normalized === 'scam') return 'Very likely scam';
  if (normalized === 'suspicious') return 'Check first';
  return labelForProbability(score / 100);
}

export function createHfSpamReviewFromChatContent(content: string, source = 'Scam review model'): ModelReview {
  const data = extractJsonObject(content);
  const verdict = String(data.verdict ?? '').trim().toLowerCase();
  const rawScore = Number(data.risk_score);
  const score = clampScore(Number.isNaN(rawScore) ? scoreFromVerdict(verdict) : rawScore);
  const reasons = asArray(data.reasons);
  const nextSteps = asArray(data.next_steps);

  return {
    source,
    score,
    level: levelFromScore(score),
    label: verdict || 'model_review',
    headline: headlineFromScoreAndVerdict(score, verdict),
    summary: String(data.explanation ?? '').trim() || summarize(score / 100),
    reasons: reasons.length ? reasons.slice(0, 4) : ['The model marked this message for review.'],
    nextSteps: nextSteps.length ? nextSteps.slice(0, 4) : ['Do not reply yet.', 'Use an official number or a trusted person.'],
  };
}

export function combineModelReviews(reviews: ModelReview[]): HfSpamReview | null {
  if (!reviews.length) return null;

  const highest = [...reviews].sort((left, right) => right.score - left.score)[0];
  const usedModels = reviews.length;

  return {
    score: highest.score,
    level: highest.level,
    label: highest.label,
    headline: highest.headline,
    summary: usedModels > 1 ? `${highest.summary} Checked by ${usedModels} models.` : highest.summary,
    reasons: highest.reasons,
    nextSteps: highest.nextSteps,
  };
}

async function checkClassifierModel(model: string, input: string): Promise<ModelReview> {
  const response = await fetch(`${HF_CLASSIFIER_URL}/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HF_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: input,
      parameters: {
        return_all_scores: true,
      },
      options: {
        wait_for_model: true,
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error ?? `${model} failed.`);
  }

  const review = createHfSpamReviewFromScores(flattenScores(data));
  if (!review) throw new Error(`${model} returned an unreadable result.`);

  return { ...review, source: model };
}

async function checkScamReviewModel(input: string): Promise<ModelReview> {
  const response = await fetch(HF_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HF_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: HF_SCAM_REVIEW_MODEL,
      max_tokens: 260,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'You classify short messages for elder scam prevention. Return only compact JSON with keys risk_score (0-100), verdict (safe|suspicious|scam), explanation, reasons, next_steps. Do not include markdown.',
        },
        {
          role: 'user',
          content: `Message: ${input}`,
        },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message ?? data?.error ?? `${HF_SCAM_REVIEW_MODEL} failed.`);
  }

  const content = String(data?.choices?.[0]?.message?.content || data?.choices?.[0]?.message?.reasoning_content || '').trim();
  return createHfSpamReviewFromChatContent(content, HF_SCAM_REVIEW_MODEL);
}

export async function checkSpamWithHuggingFace(text: string): Promise<HfSpamReview> {
  const input = text.trim();
  if (!input) throw new Error('Paste message text first.');
  if (!HF_API_KEY) throw new Error('SMS spam check is not set up on this device.');

  const tasks = [
    ...HF_CLASSIFIER_MODELS.map((model: string) => checkClassifierModel(model, input)),
    ...(HF_SCAM_REVIEW_MODEL ? [checkScamReviewModel(input)] : []),
  ];
  const results = await Promise.allSettled(tasks);
  const reviews = results
    .filter((result): result is PromiseFulfilledResult<ModelReview> => result.status === 'fulfilled')
    .map((result) => result.value);
  const review = combineModelReviews(reviews);

  if (!review) {
    const errors = results
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result) => (result.reason instanceof Error ? result.reason.message : String(result.reason)));
    throw new Error(errors[0] ?? 'SMS spam check failed.');
  }

  return review;
}
