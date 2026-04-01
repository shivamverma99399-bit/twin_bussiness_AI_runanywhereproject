import cors from 'cors';
import express from 'express';
import { parseBusinessInputWithAI } from './lib/openaiParser.js';
import { simulateScenario } from './lib/simulationEngine.js';

const app = express();
const port = Number(process.env.PORT ?? 5000);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'business-twin-server',
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/ai-parse', async (req, res) => {
  try {
    const { input } = req.body ?? {};
    const parsed = await parseBusinessInputWithAI(input);

    if (!parsed.scenario) {
      return res.status(400).json({
        error: parsed.error ?? 'Unable to parse the business scenario.',
        metadata: parsed.metadata ?? null,
      });
    }

    return res.json(parsed);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unexpected parse error.',
    });
  }
});

app.post('/api/simulate', (req, res) => {
  try {
    const { scenario } = req.body ?? {};
    const result = simulateScenario(scenario);

    return res.json(result);
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Unexpected simulation error.',
    });
  }
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API route not found.' });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({
    error: err instanceof Error ? err.message : 'Internal server error.',
  });
});

app.listen(port, () => {
  console.log(`Business Twin server listening on http://localhost:${port}`);
});
