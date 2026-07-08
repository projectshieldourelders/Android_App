const HF_API_KEY = process.env.EXPO_PUBLIC_HUGGINGFACE_API_KEY;
const HF_OCR_MODEL = process.env.EXPO_PUBLIC_HUGGINGFACE_OCR_MODEL ?? 'google/gemma-4-31B-it:cerebras';
const HF_ASR_MODEL = process.env.EXPO_PUBLIC_HUGGINGFACE_ASR_MODEL ?? 'openai/whisper-large-v3-turbo';

export function isHfOcrConfigured() {
  return Boolean(HF_API_KEY && HF_OCR_MODEL);
}

export function isHfTranscriptionConfigured() {
  return Boolean(HF_API_KEY && HF_ASR_MODEL);
}

function getChatContent(data: any) {
  return String(data?.choices?.[0]?.message?.content || data?.choices?.[0]?.message?.reasoning_content || '').trim();
}

export async function readScreenshotTextWithHuggingFace(screenshotBase64: string, mimeType = 'image/jpeg') {
  if (!HF_API_KEY) throw new Error('Screenshot reading is not set up on this device.');
  if (!screenshotBase64) throw new Error('Add a screenshot first.');

  const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HF_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: HF_OCR_MODEL,
      max_tokens: 220,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Read the visible text in this screenshot. If it is a text message or email, focus on the message content. Return only the visible text.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType || 'image/jpeg'};base64,${screenshotBase64}`,
              },
            },
          ],
        },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message ?? data?.error ?? 'Screenshot reading failed.');

  const text = getChatContent(data);
  if (!text) throw new Error('No text was found in the screenshot.');
  return text;
}

export async function transcribeAudioWithHuggingFace(uri: string, mimeType = 'audio/mpeg') {
  if (!HF_API_KEY) throw new Error('Audio transcription is not set up on this device.');
  if (!uri) throw new Error('Upload a voicemail file first.');

  const fileResponse = await fetch(uri);
  const body = await fileResponse.blob();
  const response = await fetch(`https://router.huggingface.co/hf-inference/models/${HF_ASR_MODEL}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HF_API_KEY}`,
      'Content-Type': mimeType || 'audio/mpeg',
    },
    body,
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error ?? 'Audio transcription failed.');

  const text = String(data?.text ?? '').trim();
  if (!text) throw new Error('No speech was found in the audio file.');
  return text;
}
