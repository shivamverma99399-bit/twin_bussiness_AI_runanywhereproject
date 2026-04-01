# RunAnywhere Web SDK - Quick Reference

Quick reference for common operations with the RunAnywhere Web SDK.

## Table of Contents

- [Setup & Initialization](#setup--initialization)
- [LLM (Text Generation)](#llm-text-generation)
- [STT (Speech-to-Text)](#stt-speech-to-text)
- [TTS (Text-to-Speech)](#tts-text-to-speech)
- [VAD (Voice Activity Detection)](#vad-voice-activity-detection)
- [VLM (Vision Language Model)](#vlm-vision-language-model)
- [Tool Calling](#tool-calling)
- [Model Management](#model-management)

---

## Setup & Initialization

### Basic Setup

```typescript
import { RunAnywhere, SDKEnvironment } from '@runanywhere/web';
import { LlamaCPP } from '@runanywhere/web-llamacpp';
import { ONNX } from '@runanywhere/web-onnx';

// 1. Initialize core SDK
await RunAnywhere.initialize({
  environment: SDKEnvironment.Development,
  debug: true,
});

// 2. Register backends
await LlamaCPP.register();
await ONNX.register();

// 3. Register models
RunAnywhere.registerModels([
  {
    id: 'my-llm',
    name: 'My LLM',
    repo: 'username/repo',
    files: ['model.gguf'],
    framework: LLMFramework.LlamaCpp,
    modality: ModelCategory.Language,
    memoryRequirement: 500_000_000,
  },
]);
```

### Check SDK State

```typescript
// Acceleration mode (webgpu/cpu/wasm)
const accel = LlamaCPP.accelerationMode;

// Is SDK ready?
const isReady = LlamaCPP.isRegistered && ONNX.isRegistered;
```

---

## LLM (Text Generation)

### Simple Generation

```typescript
import { TextGeneration } from '@runanywhere/web-llamacpp';

const result = await TextGeneration.generate('Hello, world!', {
  maxTokens: 100,
  temperature: 0.7,
});

console.log(result.text);
console.log(`${result.tokensPerSecond} tok/s`);
```

### Streaming Generation

```typescript
const { stream, result, cancel } = await TextGeneration.generateStream('Tell me a story', {
  maxTokens: 512,
  temperature: 0.8,
  systemPrompt: 'You are a creative writer.',
});

// Stream tokens
for await (const token of stream) {
  process.stdout.write(token);
}

// Get final metrics
const metrics = await result;
console.log(`\n${metrics.tokensUsed} tokens in ${metrics.latencyMs}ms`);

// Cancel if needed
cancel();
```

### Generation Options

```typescript
interface GenerateOptions {
  maxTokens?: number;        // Default: 100
  temperature?: number;      // Default: 0.8 (0.0-2.0)
  topP?: number;            // Default: 1.0 (0.0-1.0)
  stopSequences?: string[]; // Stop at these strings
  systemPrompt?: string;    // System context
}
```

---

## STT (Speech-to-Text)

### Batch Transcription

```typescript
import { STT } from '@runanywhere/web-onnx';

// audioData: Float32Array of 16kHz mono audio
const result = await STT.transcribe(audioData, {
  language: 'en',
});

console.log(result.text);
```

### Streaming Transcription

```typescript
const session = await STT.createStreamingSession();

// Feed audio chunks
mic.onData((chunk: Float32Array) => {
  session.addAudio(chunk);
});

// Get partial results
session.onPartialResult((text) => {
  console.log('Partial:', text);
});

// Get final result
session.onFinalResult((text) => {
  console.log('Final:', text);
});

// Stop when done
await session.stop();
```

### STT Options

```typescript
interface TranscribeOptions {
  language?: string;    // Language code (e.g., 'en', 'es')
  maxTokens?: number;   // Max output length
}
```

---

## TTS (Text-to-Speech)

### Synthesize Speech

```typescript
import { TTS } from '@runanywhere/web-onnx';

const result = await TTS.synthesize('Hello, world!', {
  speed: 1.0,
  speakerId: 0,
});

// result.audio: Float32Array (PCM samples)
// result.sampleRate: number (e.g., 22050)

// Play audio
const player = new AudioPlayback({ sampleRate: result.sampleRate });
await player.play(result.audio, result.sampleRate);
player.dispose();
```

### TTS Options

```typescript
interface SynthesizeOptions {
  speed?: number;      // 0.5-2.0 (default: 1.0)
  speakerId?: number;  // Voice variant (default: 0)
}
```

---

## VAD (Voice Activity Detection)

### Basic Usage

```typescript
import { VAD, SpeechActivity } from '@runanywhere/web-onnx';

// Reset VAD state
VAD.reset();

// Subscribe to speech events
const unsubscribe = VAD.onSpeechActivity((activity) => {
  if (activity === SpeechActivity.Started) {
    console.log('Speech started');
  } else if (activity === SpeechActivity.Ended) {
    console.log('Speech ended');
    
    // Extract speech segment
    const segment = VAD.popSpeechSegment();
    if (segment && segment.samples.length > 1600) {
      processAudio(segment.samples);
    }
  }
});

// Feed audio chunks (16kHz mono)
mic.onData((chunk: Float32Array) => {
  VAD.processSamples(chunk);
});

// Cleanup
unsubscribe();
```

### With Microphone

```typescript
import { AudioCapture } from '@runanywhere/web';

const mic = new AudioCapture({ sampleRate: 16000 });

await mic.start(
  (chunk) => { VAD.processSamples(chunk); },  // Audio callback
  (level) => { console.log('Level:', level); } // Volume callback
);

// Stop mic
mic.stop();
```

---

## VLM (Vision Language Model)

### Single Image Inference

```typescript
import { VLMWorkerBridge, VideoCapture } from '@runanywhere/web-llamacpp';

// Start camera
const cam = new VideoCapture({ facingMode: 'environment' });
await cam.start();

// Capture frame
const frame = cam.captureFrame(256); // 256x256

// Process with VLM (runs in Web Worker)
const bridge = VLMWorkerBridge.shared;
const result = await bridge.process(
  frame.rgbPixels,   // Uint8Array (RGB)
  frame.width,
  frame.height,
  'What do you see?',
  { maxTokens: 100, temperature: 0.6 }
);

console.log(result.text);

// Cleanup
cam.stop();
```

### Load VLM Model

```typescript
// In runanywhere.ts
VLMWorkerBridge.shared.workerUrl = vlmWorkerUrl;

RunAnywhere.setVLMLoader({
  get isInitialized() { return VLMWorkerBridge.shared.isInitialized; },
  init: () => VLMWorkerBridge.shared.init(),
  loadModel: (params) => VLMWorkerBridge.shared.loadModel(params),
  unloadModel: () => VLMWorkerBridge.shared.unloadModel(),
});
```

---

## Tool Calling

### Register a Tool

```typescript
import { 
  ToolCalling, 
  toToolValue, 
  getStringArg,
  getNumberArg,
  type ToolDefinition 
} from '@runanywhere/web-llamacpp';

const weatherTool: ToolDefinition = {
  name: 'get_weather',
  description: 'Gets the current weather for a city',
  parameters: [
    { 
      name: 'location', 
      type: 'string', 
      description: 'City name', 
      required: true 
    },
  ],
  category: 'Utility',
};

const executor = async (args: Record<string, ToolValue>) => {
  const city = getStringArg(args, 'location') ?? 'Unknown';
  
  // Your implementation
  const weatherData = await fetchWeather(city);
  
  return {
    location: toToolValue(city),
    temperature_f: toToolValue(weatherData.temp),
    condition: toToolValue(weatherData.condition),
  };
};

ToolCalling.registerTool(weatherTool, executor);
```

### Generate with Tools

```typescript
const result = await ToolCalling.generateWithTools(
  'What is the weather in Tokyo?',
  {
    autoExecute: true,
    maxToolCalls: 5,
    temperature: 0.3,
    format: ToolCallFormat.Default,
  }
);

// Tool calls made
result.toolCalls.forEach((call) => {
  console.log(`Called: ${call.toolName}`, call.arguments);
});

// Tool results
result.toolResults.forEach((res) => {
  console.log('Result:', res.result);
});

// Final response
console.log('Response:', result.text);
```

### Tool Management

```typescript
// Get all registered tools
const tools = ToolCalling.getRegisteredTools();

// Unregister a tool
ToolCalling.unregisterTool('tool_name');

// Clear all tools
ToolCalling.clearTools();
```

---

## Model Management

### Load Models

```typescript
import { ModelManager, ModelCategory } from '@runanywhere/web';

// Download model (if not already downloaded)
const modelId = 'my-model';
const stream = ModelManager.downloadModel(modelId);

for await (const progress of stream) {
  console.log(`${(progress.percentage * 100).toFixed(1)}% - ${progress.state}`);
  if (progress.state === 'completed') break;
}

// Load LLM
await ModelManager.loadModel(modelId);

// Load STT
await ModelManager.loadSTTModel('stt-model-id');

// Load TTS
await ModelManager.loadTTSVoice('tts-voice-id');
```

### Check Model State

```typescript
// Check if model is loaded
const llm = ModelManager.getLoadedModel(ModelCategory.Language);
const stt = ModelManager.getLoadedModel(ModelCategory.SpeechRecognition);
const tts = ModelManager.getLoadedModel(ModelCategory.SpeechSynthesis);

console.log('LLM loaded:', llm !== null);
console.log('STT loaded:', stt !== null);
console.log('TTS loaded:', tts !== null);

// Get model info
const modelInfo = ModelManager.getModelInfo('model-id');
console.log(modelInfo?.name, modelInfo?.memoryRequirement);
```

### Unload Models

```typescript
// Unload to free memory
await ModelManager.unloadModel();         // LLM
await ModelManager.unloadSTTModel();      // STT
await ModelManager.unloadTTSVoice();      // TTS
```

---

## Voice Pipeline (Complete Flow)

### Full Voice Assistant

```typescript
import { VoicePipeline, AudioCapture, AudioPlayback } from '@runanywhere/web';
import { VAD, SpeechActivity } from '@runanywhere/web-onnx';

// 1. Start microphone
const mic = new AudioCapture({ sampleRate: 16000 });

// 2. Setup VAD
VAD.reset();
VAD.onSpeechActivity((activity) => {
  if (activity === SpeechActivity.Ended) {
    const segment = VAD.popSpeechSegment();
    if (segment) processVoice(segment.samples);
  }
});

await mic.start(
  (chunk) => VAD.processSamples(chunk),
  (level) => updateUI(level)
);

// 3. Process voice through pipeline
const processVoice = async (audioData: Float32Array) => {
  const pipeline = new VoicePipeline();
  
  const result = await pipeline.processTurn(audioData, {
    maxTokens: 60,
    temperature: 0.7,
    systemPrompt: 'You are a helpful assistant. Be concise.',
  }, {
    onTranscription: (text) => {
      console.log('You said:', text);
    },
    onResponseToken: (token, accumulated) => {
      console.log('AI:', accumulated);
    },
    onSynthesisComplete: async (audio, sampleRate) => {
      // Play TTS
      const player = new AudioPlayback({ sampleRate });
      await player.play(audio, sampleRate);
      player.dispose();
    },
  });
  
  console.log('Turn complete:', result);
};

// 4. Cleanup
mic.stop();
```

---

## Common Patterns

### Auto-scroll Chat

```typescript
const messagesEndRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages]);

// In JSX:
<div ref={messagesEndRef} />
```

### Copy to Clipboard

```typescript
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    console.log('Copied!');
  } catch (err) {
    console.error('Failed to copy:', err);
  }
};
```

### Download Progress

```typescript
const [progress, setProgress] = useState(0);

const download = async (modelId: string) => {
  const stream = ModelManager.downloadModel(modelId);
  
  for await (const p of stream) {
    setProgress(p.percentage);
    if (p.state === 'completed') break;
    if (p.state === 'failed') throw new Error('Download failed');
  }
};
```

### Error Handling

```typescript
try {
  const result = await TextGeneration.generate(prompt);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  
  if (message.includes('not initialized')) {
    console.error('SDK not initialized');
  } else if (message.includes('out of memory')) {
    console.error('Model too large');
  } else {
    console.error('Unknown error:', message);
  }
}
```

---

## TypeScript Types

### Common Interfaces

```typescript
// Generation result
interface GenerationResult {
  text: string;
  tokensUsed: number;
  tokensPerSecond: number;
  latencyMs: number;
  modelUsed: string;
}

// Streaming result
interface StreamingResult {
  stream: AsyncIterable<string>;
  result: Promise<GenerationResult>;
  cancel: () => void;
}

// Model definition
interface CompactModelDef {
  id: string;
  name: string;
  repo?: string;
  url?: string;
  files?: string[];
  framework: LLMFramework;
  modality: ModelCategory;
  memoryRequirement: number;
  artifactType?: 'archive' | 'file';
}

// Tool definition
interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  category?: string;
}

interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  required: boolean;
}

// Voice pipeline result
interface VoicePipelineResult {
  transcription: string;
  response: string;
  audio: Float32Array;
  sampleRate: number;
}
```

---

## Environment Variables

### Vite Configuration

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      // Required for SharedArrayBuffer (multi-threaded WASM)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
```

### TypeScript Config

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  }
}
```

---

## Browser Compatibility

| Feature            | Chrome | Edge | Safari | Firefox |
|--------------------|--------|------|--------|---------|
| WebAssembly        | 96+    | 96+  | 15+    | 95+     |
| OPFS               | 102+   | 102+ | 15.2+  | 111+    |
| WebGPU (optional)  | 113+   | 113+ | 18+    | No      |
| SharedArrayBuffer  | 96+*   | 96+* | 15.2+* | 95+*    |

\* Requires COOP/COEP headers

---

## Performance Tips

1. **Use streaming** - Better perceived performance
2. **Lower temperature** - Faster, more focused responses (0.1-0.5)
3. **Reduce maxTokens** - Shorter responses = faster
4. **Smaller models** - LFM2-350M is very fast
5. **Enable WebGPU** - Set COOP/COEP headers
6. **Preload models** - Download during idle time

---

## Debugging

### Enable Debug Logs

```typescript
await RunAnywhere.initialize({
  environment: SDKEnvironment.Development,
  debug: true, // Enable verbose logging
});
```

### Check Browser Console

```typescript
// Log model state
console.log('LLM:', ModelManager.getLoadedModel(ModelCategory.Language));
console.log('STT:', ModelManager.getLoadedModel(ModelCategory.SpeechRecognition));
console.log('TTS:', ModelManager.getLoadedModel(ModelCategory.SpeechSynthesis));

// Log acceleration mode
console.log('Acceleration:', LlamaCPP.accelerationMode);

// Log registered models
console.log('Models:', ModelManager.getAvailableModels());
```

### Performance Profiling

```typescript
const t0 = performance.now();
const result = await TextGeneration.generate(prompt);
const t1 = performance.now();

console.log(`Total: ${t1 - t0}ms`);
console.log(`TTFT: ${result.timeToFirstTokenMs}ms`);
console.log(`Throughput: ${result.tokensPerSecond} tok/s`);
```

---

## Resources

- [Full Documentation](https://docs.runanywhere.ai/web/introduction)
- [Features Guide](./FEATURES_GUIDE.md)
- [GitHub Issues](https://github.com/RunanywhereAI/runanywhere-sdks/issues)
