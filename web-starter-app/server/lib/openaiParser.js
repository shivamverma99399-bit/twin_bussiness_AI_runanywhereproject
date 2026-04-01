import { parseBusinessInputFallback } from './fallbackParser.js';

const OPENAI_URL = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1/responses';
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';

function sanitizeScenario(candidate, originalInput) {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const type = candidate.type === 'discount' ? 'discount' : candidate.type === 'price_increase' ? 'price_increase' : null;
  const value = Number(candidate.value);

  if (!type || !Number.isFinite(value)) {
    return null;
  }

  const normalizedValue = Math.min(Math.max(value, 1), 80);

  return {
    type,
    value: normalizedValue,
    unit: 'percent',
    label:
      type === 'discount'
        ? `Discount by ${normalizedValue}%`
        : `Increase price by ${normalizedValue}%`,
    explanation:
      type === 'discount'
        ? `A ${normalizedValue}% discount should boost demand, while putting pressure on margin.`
        : `A ${normalizedValue}% price increase should lift unit economics, but it may reduce demand.`,
    originalInput,
    source: 'openai',
  };
}

function extractTextPayload(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text;
  }

  const content = data?.output?.[0]?.content;
  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .filter((item) => item?.type === 'output_text' && typeof item.text === 'string')
    .map((item) => item.text)
    .join('\n');
}

export async function parseBusinessInputWithAI(rawInput) {
  const input = String(rawInput ?? '').trim();

  if (!process.env.OPENAI_API_KEY) {
    const fallback = parseBusinessInputFallback(input);
    return {
      ...fallback,
      metadata: {
        provider: 'fallback',
        reason: 'OPENAI_API_KEY is not configured.',
      },
    };
  }

  try {
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          {
            role: 'system',
            content:
              'Convert the business instruction into JSON with keys: type ("discount" or "price_increase"), value (number percent only). Return JSON only.',
          },
          {
            role: 'user',
            content: input,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI parse request failed with status ${response.status}.`);
    }

    const data = await response.json();
    const payload = extractTextPayload(data);
    const parsed = sanitizeScenario(JSON.parse(payload), input);

    if (!parsed) {
      throw new Error('OpenAI response did not contain a valid business scenario.');
    }

    return {
      scenario: parsed,
      error: null,
      metadata: {
        provider: 'openai',
        model: OPENAI_MODEL,
      },
    };
  } catch (error) {
    const fallback = parseBusinessInputFallback(input);
    return {
      ...fallback,
      metadata: {
        provider: 'fallback',
        reason: error instanceof Error ? error.message : 'Unknown OpenAI error.',
      },
    };
  }
}
