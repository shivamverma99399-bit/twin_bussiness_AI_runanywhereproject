import { useEffect, useRef, useState } from 'react';
import { parseBusinessInput, simulateBusinessScenario, type SimulationResponse } from '../lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  result?: SimulationResponse;
  metadataNote?: string;
  error?: boolean;
}

const starterPrompts = [
  'Offer a 10% discount on our main product line',
  'Raise prices by 6% for enterprise customers',
  'Run a 15% weekend discount to increase sales',
];

function formatDelta(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function resultTone(value: number) {
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return 'neutral';
}

export function ChatTab() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Describe a pricing move and I will turn it into a simulation. Try a discount or a price increase.',
    },
  ]);
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, submitting]);

  async function handleSubmit(promptOverride?: string) {
    const text = (promptOverride ?? input).trim();
    if (!text || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setInput('');

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
    };

    setMessages((prev) => [...prev, userMessage]);

    try {
      const parsed = await parseBusinessInput(text);
      const simulation = await simulateBusinessScenario(parsed.scenario);

      const metadataNote =
        parsed.metadata?.provider === 'fallback'
          ? `Fallback parser used${parsed.metadata.reason ? `: ${parsed.metadata.reason}` : '.'}`
          : parsed.metadata?.model
            ? `Parsed with ${parsed.metadata.model}.`
            : 'Parsed with AI assistance.';

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: simulation.narrative,
        result: simulation,
        metadataNote,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Something went wrong while running the simulation.';
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          text: message,
          error: true,
        },
      ]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="tab-panel chat-panel business-twin-panel">
      <section className="hero-card">
        <p className="eyebrow">Business Twin</p>
        <h2>Test pricing decisions before they hit the business.</h2>
        <p className="hero-copy">
          The app parses a pricing instruction, simulates the likely demand impact, and estimates how revenue,
          profit, and risk may shift.
        </p>
        <div className="starter-pills">
          {starterPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="pill-button"
              onClick={() => void handleSubmit(prompt)}
              disabled={submitting}
            >
              {prompt}
            </button>
          ))}
        </div>
      </section>

      <div className="message-list" ref={listRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`message message-${msg.role}`}>
            <div className={`message-bubble${msg.error ? ' message-error' : ''}`}>
              <p>{msg.text}</p>
              {msg.metadataNote && <div className="message-stats">{msg.metadataNote}</div>}
              {msg.result && (
                <div className="result-card">
                  <div className="result-card-header">
                    <div>
                      <h3>{msg.result.scenario.label}</h3>
                      <p>{msg.result.scenario.explanation}</p>
                    </div>
                    <span className={`risk-badge risk-${msg.result.metrics.risk}`}>{msg.result.metrics.risk} risk</span>
                  </div>
                  <div className="metrics-grid">
                    <article className={`metric-card metric-${resultTone(msg.result.metrics.revenueChangePct)}`}>
                      <span>Revenue</span>
                      <strong>{formatDelta(msg.result.metrics.revenueChangePct)}</strong>
                    </article>
                    <article className={`metric-card metric-${resultTone(msg.result.metrics.profitChangePct)}`}>
                      <span>Profit</span>
                      <strong>{formatDelta(msg.result.metrics.profitChangePct)}</strong>
                    </article>
                    <article className={`metric-card metric-${resultTone(msg.result.metrics.demandChangePct)}`}>
                      <span>Demand</span>
                      <strong>{formatDelta(msg.result.metrics.demandChangePct)}</strong>
                    </article>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {submitting && (
          <div className="message message-assistant">
            <div className="message-bubble loading-bubble">
              <div className="loading-dots">
                <span />
                <span />
                <span />
              </div>
              <p>Parsing the pricing move and running the simulation...</p>
            </div>
          </div>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <form
        className="chat-input"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <input
          type="text"
          placeholder="Example: Offer a 12% discount to boost sales"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={submitting}
        />
        <button type="submit" className="btn btn-primary" disabled={!input.trim() || submitting}>
          {submitting ? 'Running...' : 'Simulate'}
        </button>
      </form>
    </div>
  );
}
