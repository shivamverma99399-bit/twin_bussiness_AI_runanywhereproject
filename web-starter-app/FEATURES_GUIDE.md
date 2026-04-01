# RunAnywhere Web SDK - Features Guide

This guide explains all the AI features implemented in your starter app and how to use/extend them.

## Table of Contents

- [Overview](#overview)
- [1. LLM Chat (Text Generation)](#1-llm-chat-text-generation)
- [2. Vision (VLM)](#2-vision-vlm)
- [3. Voice Pipeline (STT + LLM + TTS + VAD)](#3-voice-pipeline-stt--llm--tts--vad)
- [4. Tool Calling](#4-tool-calling)
- [Common Patterns](#common-patterns)
- [Extending the App](#extending-the-app)

---

## Overview

Your app demonstrates **on-device AI** running entirely in the browser via WebAssembly:

- **@runanywhere/web** - Core SDK (initialization, model management, events)
- **@runanywhere/web-llamacpp** - LLM & VLM inference via llama.cpp WASM
- **@runanywhere/web-onnx** - STT, TTS & VAD via sherpa-onnx WASM

All inference runs locally - no data leaves the browser. Models are cached in OPFS (Origin Private File System) for persistence across sessions.

---

## 1. LLM Chat (Text Generation)

**Location:** `src/components/ChatTab.tsx`

### What It Does

Provides a conversational interface with streaming text generation. Messages appear token-by-token for a responsive UX.

### Key Implementation Details

```typescript
// 1. Ensure model is loaded
if (loader.state !== 'ready') {
  await loader.ensure(); // Downloads + loads model
}

// 2. Generate with streaming
const { stream, result: resultPromise, cancel } = await TextGeneration.generateStream(text, {
  maxTokens: 512,
  temperature: 0.7,
});

// 3. Stream tokens as they arrive
let accumulated = '';
for await (const token of stream) {
  accumulated += token;
  // Update UI with each token
  setMessages((prev) => {
    const updated = [...prev];
    updated[assistantIdx] = { role: 'assistant', text: accumulated };
    return updated;
  });
}

// 4. Get final metrics
const result = await resultPromise;
console.log(`${result.tokensUsed} tokens at ${result.tokensPerSecond} tok/s`);
```

### Generation Options

```typescript
interface GenerateOptions {
  maxTokens?: number;      // Maximum tokens to generate (default: 100)
  temperature?: number;    // Randomness 0.0-2.0 (default: 0.8)
  topP?: number;           // Nucleus sampling (default: 1.0)
  stopSequences?: string[]; // Stop generation at these strings
  systemPrompt?: string;   // System context/instructions
}
```

### Use Cases

- **Chatbots** - Conversational AI assistants
- **Content generation** - Articles, emails, stories
- **Code completion** - Programming assistance
- **Q&A systems** - Question answering

### Extending

```typescript
// Add system prompt for specialized behavior
const { stream } = await TextGeneration.generateStream(text, {
  systemPrompt: 'You are a helpful coding assistant. Write clean, well-commented code.',
  maxTokens: 512,
  temperature: 0.3, // Lower temp for more focused code
});

// Add chat history for context
const conversationContext = messages
  .map(m => `${m.role}: ${m.text}`)
  .join('\n');

const prompt = `${conversationContext}\nuser: ${newMessage}\nassistant:`;
```

---

## 2. Vision (VLM)

**Location:** `src/components/VisionTab.tsx`

### What It Does

Vision Language Models (VLMs) process images + text prompts together. The app captures frames from your camera and describes what it sees.

### Key Implementation Details

```typescript
// 1. Start camera
const cam = new VideoCapture({ facingMode: 'environment' });
await cam.start();

// 2. Capture a frame (RGB pixels)
const frame = cam.captureFrame(256); // 256x256 for efficiency

// 3. Process with VLM (runs in Web Worker)
const bridge = VLMWorkerBridge.shared;
const res = await bridge.process(
  frame.rgbPixels,  // Uint8Array of RGB data
  frame.width,
  frame.height,
  'Describe what you see briefly.',
  { maxTokens: 80, temperature: 0.6 }
);

console.log(res.text); // "A person sitting at a desk with a laptop..."
```

### Modes

#### Single-shot Mode
- Capture and analyze one frame at a time
- Higher token limit for detailed descriptions
- User controls when to capture

#### Live Mode
- Continuous inference every 2.5 seconds
- Lower token limit for faster responses
- Automatic processing while camera is active
- Skips frames if inference is still running

### Use Cases

- **Visual Q&A** - "What's in this image?"
- **Object detection** - "List all objects you see"
- **Scene understanding** - "Describe this location"
- **Accessibility** - Describe surroundings for visually impaired users
- **Product recognition** - "What brand is this?"

### Architecture Notes

VLM inference runs in a **dedicated Web Worker** (`src/workers/vlm-worker.ts`) to keep the UI responsive. The worker loads the VLM model once and processes inference requests from the main thread.

### Extending

```typescript
// Custom prompts for specific tasks
const prompts = {
  objectDetection: 'List all objects you see in this image.',
  textExtraction: 'What text appears in this image?',
  sceneDescription: 'Describe this scene in detail.',
  safety: 'Are there any safety hazards visible?',
};

// Add zoom controls
const captureWithZoom = (zoomLevel: number) => {
  const size = Math.floor(256 * zoomLevel);
  return cam.captureFrame(size);
};
```

---

## 3. Voice Pipeline (STT + LLM + TTS + VAD)

**Location:** `src/components/VoiceTab.tsx`

### What It Does

A complete voice assistant pipeline:
1. **VAD** (Voice Activity Detection) - Detects when you speak
2. **STT** (Speech-to-Text) - Transcribes your speech
3. **LLM** (Language Model) - Generates a response
4. **TTS** (Text-to-Speech) - Speaks the response

### Key Implementation Details

```typescript
// 1. Start microphone with VAD
const mic = new AudioCapture({ sampleRate: 16000 });
VAD.reset();

// 2. Subscribe to speech activity events
VAD.onSpeechActivity((activity) => {
  if (activity === SpeechActivity.Ended) {
    const segment = VAD.popSpeechSegment();
    if (segment && segment.samples.length > 1600) {
      processSpeech(segment.samples); // Process the speech segment
    }
  }
});

// 3. Feed audio to VAD
await mic.start(
  (chunk) => { VAD.processSamples(chunk); }, // Audio callback
  (level) => { setAudioLevel(level); },      // Volume callback
);

// 4. Process speech through full pipeline
const pipeline = new VoicePipeline();
const result = await pipeline.processTurn(audioData, {
  maxTokens: 60,
  temperature: 0.7,
  systemPrompt: 'You are a helpful voice assistant. Keep responses concise.',
}, {
  onTranscription: (text) => console.log('You said:', text),
  onResponseToken: (token, accumulated) => console.log('AI:', accumulated),
  onSynthesisComplete: async (audio, sampleRate) => {
    // Play TTS audio
    const player = new AudioPlayback({ sampleRate });
    await player.play(audio, sampleRate);
    player.dispose();
  },
});
```

### Components

#### 1. VAD (Voice Activity Detection)
- **Purpose:** Detect speech vs silence in real-time
- **Model:** Silero VAD (via sherpa-onnx)
- **How it works:** 
  - Analyzes audio in chunks
  - Emits `SpeechActivity.Started` and `SpeechActivity.Ended` events
  - Extracts speech segments automatically

#### 2. STT (Speech-to-Text)
- **Purpose:** Transcribe speech to text
- **Model:** Whisper Tiny English (ONNX)
- **Input:** Float32Array of 16kHz mono audio
- **Output:** Transcribed text

#### 3. LLM (Language Model)
- **Purpose:** Generate natural language response
- **Model:** LFM2-350M (small & fast for voice)
- **Streaming:** Tokens generated progressively

#### 4. TTS (Text-to-Speech)
- **Purpose:** Synthesize speech from text
- **Model:** Piper TTS (US English - Lessac voice)
- **Output:** Float32Array of PCM audio at 22050 Hz

### Audio Orb Visualization

The voice tab displays an animated orb that reflects:
- **Idle** - Static blue circle
- **Listening** - Pulsing with audio level
- **Processing** - Spinning animation
- **Speaking** - Solid state

```typescript
<div 
  className="voice-orb" 
  data-state={voiceState} 
  style={{ '--level': audioLevel } as React.CSSProperties}
>
  <div className="voice-orb-inner" />
</div>
```

### Use Cases

- **Voice assistants** - "What's the weather?"
- **Hands-free control** - "Start timer for 5 minutes"
- **Accessibility** - Voice-based navigation
- **Language learning** - Practice conversations
- **Voice notes** - Transcribe + summarize

### Extending

```typescript
// Add wake word detection
VAD.onSpeechActivity((activity) => {
  if (activity === SpeechActivity.Started) {
    console.log('Speech detected - listening for wake word...');
  }
});

// Add conversation history
const conversationHistory: string[] = [];
pipeline.processTurn(audioData, {
  systemPrompt: `Previous conversation:\n${conversationHistory.join('\n')}\n\nRespond to the latest question.`,
});

// Add voice selection
const voices = [
  'vits-piper-en_US-lessac-medium',
  'vits-piper-en_US-amy-medium',
];
await RunAnywhere.loadTTSVoice(voices[selectedIndex]);
```

---

## 4. Tool Calling

**Location:** `src/components/ToolsTab.tsx`

### What It Does

Enables LLMs to call functions and interact with external tools. The model decides which tools to call based on your query, executes them, and uses the results in its response.

### Key Implementation Details

```typescript
// 1. Define a tool
const weatherTool: ToolDefinition = {
  name: 'get_weather',
  description: 'Gets the current weather for a city',
  parameters: [
    { 
      name: 'location', 
      type: 'string', 
      description: 'City name (e.g. "San Francisco")', 
      required: true 
    },
  ],
  category: 'Utility',
};

// 2. Register executor
ToolCalling.registerTool(weatherTool, async (args) => {
  const city = getStringArg(args, 'location') ?? 'Unknown';
  const temp = Math.round(45 + Math.random() * 50);
  return {
    location: toToolValue(city),
    temperature_f: toToolValue(temp),
    condition: toToolValue('Sunny'),
  };
});

// 3. Generate with tools
const result = await ToolCalling.generateWithTools('What is the weather in Tokyo?', {
  autoExecute: true,    // Automatically execute tool calls
  maxToolCalls: 5,      // Max iterations
  temperature: 0.3,     // Lower temp for more deterministic tool calls
  format: ToolCallFormat.Default,
});

// 4. Process results
result.toolCalls.forEach((call, i) => {
  console.log(`Tool: ${call.toolName}`);
  console.log(`Args:`, call.arguments);
  console.log(`Result:`, result.toolResults[i].result);
});
console.log('Final response:', result.text);
```

### Built-in Demo Tools

1. **get_weather** - Mock weather API
2. **calculate** - Evaluate math expressions
3. **get_time** - Get current time in any timezone
4. **random_number** - Generate random integers

### Tool Execution Flow

```
User Query → LLM decides tools needed → Parse tool calls →
Execute tools → Feed results back to LLM → Final response
```

Example:
```
Query: "What's the weather in Tokyo and what time is it there?"

1. LLM calls: get_weather(location="Tokyo")
   Result: { temperature_f: 72, condition: "Sunny" }

2. LLM calls: get_time(timezone="Asia/Tokyo")
   Result: { datetime: "Friday, March 15, 2024 at 3:45:00 PM JST" }

3. Final response: "It's currently 72°F and sunny in Tokyo. The local time is 3:45 PM JST."
```

### Use Cases

- **API integration** - Call external APIs (weather, search, etc.)
- **Database queries** - Read/write data
- **Calculations** - Complex math operations
- **Multi-step workflows** - Chain multiple operations
- **Agent systems** - Autonomous task completion

### Custom Tool Registration

The app includes a UI for registering custom tools:

```typescript
const registerCustomTool = () => {
  const def: ToolDefinition = {
    name: 'search_database',
    description: 'Searches the product database',
    parameters: [
      { name: 'query', type: 'string', description: 'Search query', required: true },
      { name: 'limit', type: 'number', description: 'Max results', required: false },
    ],
    category: 'Custom',
  };

  const executor = async (args: Record<string, ToolValue>) => {
    const query = getStringArg(args, 'query') ?? '';
    const limit = getNumberArg(args, 'limit') ?? 10;
    
    // Your implementation here
    const results = await searchDatabase(query, limit);
    
    return {
      results: toToolValue(results.length),
      query: toToolValue(query),
    };
  };

  ToolCalling.registerTool(def, executor);
};
```

### Extending

```typescript
// Add structured output validation
const jsonSchemaTool: ToolDefinition = {
  name: 'extract_data',
  description: 'Extract structured data from text',
  parameters: [
    { name: 'text', type: 'string', description: 'Input text', required: true },
    { name: 'schema', type: 'string', description: 'JSON schema', required: true },
  ],
};

// Add tool call history
const toolCallHistory: ToolCall[] = [];
result.toolCalls.forEach(call => {
  toolCallHistory.push(call);
  console.log(`[${new Date().toISOString()}] ${call.toolName}`, call.arguments);
});

// Add retry logic
const executeWithRetry = async (call: ToolCall, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await executeTool(call);
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
};
```

---

## Common Patterns

### Model Loading Pattern

All tabs use the same model loading pattern via `useModelLoader` hook:

```typescript
const loader = useModelLoader(ModelCategory.Language);

// Check state
loader.state; // 'idle' | 'downloading' | 'loading' | 'ready' | 'error'
loader.progress; // 0-1 download progress
loader.error; // Error message if any

// Ensure model is loaded (downloads if needed)
const success = await loader.ensure();
```

### Error Handling

```typescript
try {
  const result = await TextGeneration.generateStream(prompt);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  
  if (msg.includes('not initialized')) {
    // SDK not ready
  } else if (msg.includes('out of memory')) {
    // Model too large for device
  } else {
    // Other error
  }
}
```

### Cancellation

All long-running operations support cancellation:

```typescript
// Text generation
const { cancel } = await TextGeneration.generateStream(prompt);
// Later...
cancel();

// Voice session
micRef.current?.stop();
vadUnsub.current?.();

// Camera
captureRef.current?.stop();
```

### Model Management

```typescript
import { ModelManager, ModelCategory } from '@runanywhere/web';

// Check if model is loaded
const llmLoaded = ModelManager.getLoadedModel(ModelCategory.Language);
const sttLoaded = ModelManager.getLoadedModel(ModelCategory.SpeechRecognition);

// Unload to free memory
await RunAnywhere.unloadModel(); // Unload LLM
await RunAnywhere.unloadSTTModel(); // Unload STT

// Get model info
const modelInfo = ModelManager.getModelInfo('model-id');
console.log(modelInfo.memoryRequirement, modelInfo.files);
```

---

## Extending the App

### Add a New Model

Edit `src/runanywhere.ts`:

```typescript
const MODELS: CompactModelDef[] = [
  // ... existing models
  {
    id: 'my-custom-model',
    name: 'My Custom Model',
    repo: 'username/model-name', // HuggingFace repo
    files: ['model.gguf'],
    framework: LLMFramework.LlamaCpp,
    modality: ModelCategory.Language,
    memoryRequirement: 1_000_000_000, // 1GB
  },
];
```

### Add a New Tab

Create `src/components/MyTab.tsx`:

```typescript
export function MyTab() {
  const loader = useModelLoader(ModelCategory.Language);
  const [output, setOutput] = useState('');

  const process = async () => {
    if (loader.state !== 'ready') {
      await loader.ensure();
    }

    // Your logic here
    const result = await TextGeneration.generateStream('...');
    // ...
  };

  return (
    <div className="tab-panel">
      <ModelBanner
        state={loader.state}
        progress={loader.progress}
        error={loader.error}
        onLoad={loader.ensure}
        label="LLM"
      />
      {/* Your UI */}
    </div>
  );
}
```

Add to `App.tsx`:

```typescript
import { MyTab } from './components/MyTab';

type Tab = 'chat' | 'vision' | 'voice' | 'tools' | 'mytab';

// In JSX:
<button onClick={() => setActiveTab('mytab')}>My Tab</button>

{activeTab === 'mytab' && <MyTab />}
```

### Add Persistent Chat History

```typescript
// Save to localStorage
const saveHistory = (messages: Message[]) => {
  localStorage.setItem('chat_history', JSON.stringify(messages));
};

// Load from localStorage
const loadHistory = (): Message[] => {
  const stored = localStorage.getItem('chat_history');
  return stored ? JSON.parse(stored) : [];
};

// Initialize with history
const [messages, setMessages] = useState<Message[]>(loadHistory());

// Save on change
useEffect(() => {
  saveHistory(messages);
}, [messages]);
```

### Add User Settings

```typescript
interface Settings {
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

const [settings, setSettings] = useState<Settings>({
  temperature: 0.7,
  maxTokens: 512,
  systemPrompt: '',
});

// Use in generation
const result = await TextGeneration.generateStream(prompt, {
  temperature: settings.temperature,
  maxTokens: settings.maxTokens,
  systemPrompt: settings.systemPrompt || undefined,
});
```

### Add Markdown Rendering

```bash
npm install react-markdown
```

```typescript
import ReactMarkdown from 'react-markdown';

<ReactMarkdown>{message.text}</ReactMarkdown>
```

---

## Performance Tips

1. **Use smaller models** - LFM2-350M is fast and efficient for most tasks
2. **Adjust token limits** - Lower maxTokens for faster responses
3. **Enable WebGPU** - Set COOP/COEP headers for multi-threaded WASM
4. **Cache models** - Models persist in OPFS between sessions
5. **Use streaming** - Show progress instead of waiting for full response
6. **Optimize prompts** - Shorter prompts = faster generation

---

## Troubleshooting

### Model fails to load
- Check browser console for errors
- Ensure enough disk space (models can be 500MB-2GB)
- Try a smaller model

### Audio not working
- Grant microphone permissions
- Check browser compatibility (Chrome/Edge 96+)
- Verify sample rate (16000 Hz for STT)

### Slow generation
- Use a smaller model
- Lower maxTokens
- Enable COOP/COEP headers for WebGPU
- Test on a different device

### Camera not working
- Grant camera permissions
- Check browser security context (HTTPS required)
- Verify camera is not in use by another app

---

## Resources

- [RunAnywhere Web Docs](https://docs.runanywhere.ai/web/introduction)
- [GitHub Issues](https://github.com/RunanywhereAI/runanywhere-sdks/issues)
- [HuggingFace Models](https://huggingface.co/models?library=gguf)
- [llama.cpp](https://github.com/ggerganov/llama.cpp)
- [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx)
