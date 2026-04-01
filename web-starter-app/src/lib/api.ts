export type ScenarioType = 'discount' | 'price_increase';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface ParsedScenario {
  type: ScenarioType;
  value: number;
  unit: 'percent';
  label: string;
  explanation: string;
  originalInput: string;
  source: 'openai' | 'fallback';
}

export interface ParseResponse {
  scenario: ParsedScenario;
  error: string | null;
  metadata?: {
    provider: 'openai' | 'fallback';
    reason?: string;
    model?: string;
  };
}

export interface SimulationResponse {
  scenario: ParsedScenario;
  metrics: {
    demandChangePct: number;
    revenueChangePct: number;
    profitChangePct: number;
    risk: RiskLevel;
  };
  narrative: string;
}

interface ApiErrorPayload {
  error?: string;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as T | ApiErrorPayload | null;

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : `Request failed with status ${response.status}.`;
    throw new Error(message);
  }

  if (!data) {
    throw new Error('The server returned an empty response.');
  }

  return data as T;
}

export async function parseBusinessInput(input: string): Promise<ParseResponse> {
  const response = await fetch('/api/ai-parse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input }),
  });

  return parseJsonResponse<ParseResponse>(response);
}

export async function simulateBusinessScenario(scenario: ParsedScenario): Promise<SimulationResponse> {
  const response = await fetch('/api/simulate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ scenario }),
  });

  return parseJsonResponse<SimulationResponse>(response);
}
