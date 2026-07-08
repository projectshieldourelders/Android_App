import { AiScamReview, AnalysisResult, RiskLevel } from '../types/app';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const OPENAI_MODEL = process.env.EXPO_PUBLIC_OPENAI_MODEL ?? 'gpt-5.4-mini';

type AiReviewInput = {
  messageText: string;
  transcript: string;
  screenshotBase64: string;
  localResult: AnalysisResult;
};

type RawAiReview = Partial<AiScamReview> & {
  level?: string;
  score?: number;
  reasons?: unknown;
  nextSteps?: unknown;
};

const allowedLevels: RiskLevel[] = ['low', 'caution', 'high', 'stop'];

export function isAiReviewConfigured() {
  return Boolean(OPENAI_API_KEY);
}

function normalizeLevel(level: unknown, fallback: RiskLevel): RiskLevel {
  return typeof level === 'string' && allowedLevels.includes(level as RiskLevel) ? (level as RiskLevel) : fallback;
}

function normalizeList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  return value
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 4);
}

function clampScore(value: unknown, fallback: number) {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function extractOutputText(response: any) {
  if (typeof response?.output_text === 'string') return response.output_text;

  const chunks: string[] = [];
  for (const item of response?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (typeof content?.text === 'string') chunks.push(content.text);
      if (typeof content?.json === 'object') chunks.push(JSON.stringify(content.json));
    }
  }

  return chunks.join('\n').trim();
}

function parseAiJson(text: string): RawAiReview {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const jsonText = fenced ?? trimmed;
  return JSON.parse(jsonText) as RawAiReview;
}

function normalizeAiReview(raw: RawAiReview, fallback: AnalysisResult): AiScamReview {
  return {
    score: clampScore(raw.score, fallback.score),
    level: normalizeLevel(raw.level, fallback.level),
    headline: String(raw.headline || fallback.headline).trim(),
    summary: String(raw.summary || fallback.summary).trim(),
    reasons: normalizeList(
      raw.reasons,
      fallback.findings.length ? fallback.findings.slice(0, 3).map((finding) => finding.title) : ['No major pressure signs found'],
    ),
    nextSteps: normalizeList(raw.nextSteps, fallback.nextSteps),
    screenshotText: typeof raw.screenshotText === 'string' ? raw.screenshotText.trim().slice(0, 500) : undefined,
  };
}

export async function reviewScamWithAi({ messageText, transcript, screenshotBase64, localResult }: AiReviewInput): Promise<AiScamReview> {
  if (!OPENAI_API_KEY) {
    throw new Error('AI review is not set up on this device.');
  }

  const textParts = [
    messageText.trim() ? `Pasted message:\n${messageText.trim()}` : '',
    transcript.trim() ? `Voicemail transcript:\n${transcript.trim()}` : '',
  ].filter(Boolean);

  const prompt = [
    'You are a scam-safety reviewer for older adults.',
    'Review the pasted text and screenshot, if present.',
    'If a screenshot is present, read the visible text in it.',
    'Do not say something is definitely a scam unless the pattern is clear.',
    'Keep language short, calm, and practical.',
    'Return JSON only with this exact shape:',
    '{"score":0,"level":"low|caution|high|stop","headline":"","summary":"","reasons":[""],"nextSteps":[""],"screenshotText":""}',
    '',
    `Local checker result: ${localResult.score}/100, ${localResult.level}, ${localResult.headline}`,
    textParts.length ? textParts.join('\n\n') : 'No pasted text was provided.',
  ].join('\n');

  const content: Array<Record<string, unknown>> = [{ type: 'input_text', text: prompt }];
  if (screenshotBase64) {
    content.push({
      type: 'input_image',
      image_url: `data:image/jpeg;base64,${screenshotBase64}`,
      detail: 'high',
    });
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: 'user',
          content,
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'scam_review',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              score: { type: 'number', minimum: 0, maximum: 100 },
              level: { type: 'string', enum: allowedLevels },
              headline: { type: 'string' },
              summary: { type: 'string' },
              reasons: { type: 'array', items: { type: 'string' }, maxItems: 4 },
              nextSteps: { type: 'array', items: { type: 'string' }, maxItems: 4 },
              screenshotText: { type: 'string' },
            },
            required: ['score', 'level', 'headline', 'summary', 'reasons', 'nextSteps', 'screenshotText'],
          },
        },
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message ?? 'AI review failed.');
  }

  return normalizeAiReview(parseAiJson(extractOutputText(data)), localResult);
}
