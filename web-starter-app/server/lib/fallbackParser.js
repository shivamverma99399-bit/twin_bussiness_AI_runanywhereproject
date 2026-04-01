const discountPatterns = [
  /discount(?:\s+by|\s+of)?\s+(\d+(?:\.\d+)?)\s*%/i,
  /reduce\s+price(?:s)?\s+by\s+(\d+(?:\.\d+)?)\s*%/i,
  /cut\s+price(?:s)?\s+by\s+(\d+(?:\.\d+)?)\s*%/i,
];

const priceIncreasePatterns = [
  /increase\s+price(?:s)?(?:\s+by)?\s+(\d+(?:\.\d+)?)\s*%/i,
  /raise\s+price(?:s)?(?:\s+by)?\s+(\d+(?:\.\d+)?)\s*%/i,
  /price\s+increase(?:\s+of)?\s+(\d+(?:\.\d+)?)\s*%/i,
];

function clampPercent(value) {
  return Math.min(Math.max(value, 1), 80);
}

function detectChange(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return clampPercent(Number(match[1]));
    }
  }

  return null;
}

function buildScenario(type, value, originalInput, source) {
  const normalizedValue = clampPercent(value);

  return {
    type,
    value: normalizedValue,
    unit: 'percent',
    label: type === 'discount' ? `Discount by ${normalizedValue}%` : `Increase price by ${normalizedValue}%`,
    explanation:
      type === 'discount'
        ? `A ${normalizedValue}% discount should boost demand, while putting pressure on margin.`
        : `A ${normalizedValue}% price increase should lift unit economics, but it may reduce demand.`,
    originalInput,
    source,
  };
}

export function parseBusinessInputFallback(rawInput) {
  const input = String(rawInput ?? '').trim();

  if (!input) {
    return {
      scenario: null,
      error: 'Please enter a business scenario to simulate.',
    };
  }

  const discountValue = detectChange(input, discountPatterns);

  if (discountValue !== null) {
    return {
      scenario: buildScenario('discount', discountValue, input, 'fallback'),
      error: null,
    };
  }

  const priceIncreaseValue = detectChange(input, priceIncreasePatterns);

  if (priceIncreaseValue !== null) {
    return {
      scenario: buildScenario('price_increase', priceIncreaseValue, input, 'fallback'),
      error: null,
    };
  }

  const numericMatch = input.match(/(\d+(?:\.\d+)?)\s*%/);
  if (numericMatch) {
    const value = clampPercent(Number(numericMatch[1]));
    const inferredType = /discount|promo|sale|markdown/i.test(input) ? 'discount' : 'price_increase';
    return {
      scenario: buildScenario(inferredType, value, input, 'fallback'),
      error: null,
    };
  }

  return {
    scenario: null,
    error: 'I could not detect a discount or price change. Try something like "offer a 10% discount" or "raise prices by 6%".',
  };
}
