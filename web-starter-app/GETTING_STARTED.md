# Getting Started with RunAnywhere Web SDK

Step-by-step guide to get up and running with the RunAnywhere Web SDK starter app.

## Prerequisites

Before you begin, ensure you have:

- [ ] **Node.js 18+** installed ([download](https://nodejs.org/))
- [ ] **npm** or **yarn** package manager
- [ ] **Modern browser** (Chrome 96+, Edge 96+, or Safari 15.2+)
- [ ] **4GB+ RAM** available (for running models)
- [ ] **2-5GB disk space** (for model downloads)
- [ ] **HTTPS** for production (required for camera/microphone)

## Installation

### 1. Install Dependencies

```bash
# Clone or navigate to project directory
cd web-starter-app

# Install packages
npm install

# Verify installation
npm list @runanywhere/web @runanywhere/web-llamacpp @runanywhere/web-onnx
```

You should see:
```
├── @runanywhere/web@0.1.0-beta.10
├── @runanywhere/web-llamacpp@0.1.0-beta.10
└── @runanywhere/web-onnx@0.1.0-beta.10
```

### 2. Start Development Server

```bash
npm run dev
```

You should see:
```
VITE v6.0.0  ready in 500 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### 3. Open in Browser

Navigate to [http://localhost:5173](http://localhost:5173)

You should see:
- "Loading RunAnywhere SDK..." briefly
- Then the app with 4 tabs: Chat, Vision, Voice, Tools

---

## First Steps: Chat Tab

Let's test the basic LLM functionality:

### 1. Load the Model

1. Click the **Chat** tab
2. You'll see: "Click to download and load LLM model"
3. Click the banner
4. Wait for download (350MB for LFM2-350M)
5. Progress bar shows download status
6. Model loads into memory (takes 5-10 seconds)

### 2. Chat with the AI

1. Type "Hello!" in the input box
2. Click "Send"
3. Watch tokens appear in real-time (streaming)
4. See performance metrics below the response:
   - Token count
   - Tokens per second (should be 5-20 tok/s on typical hardware)
   - Latency in milliseconds

### 3. Try Different Prompts

```
"Explain quantum computing in simple terms"
"Write a haiku about coding"
"What are 3 benefits of on-device AI?"
```

### 4. Check Acceleration Mode

Look at the header badge:
- **WebGPU** = Optimal performance (multi-threaded WASM)
- **CPU** = Fallback mode (still functional, but slower)

---

## Vision Tab Walkthrough

Test multimodal image understanding:

### 1. Load VLM Model

1. Click **Vision** tab
2. Click "Click to download and load VLM model"
3. Downloads 2 files: main model + vision encoder (~450MB total)
4. Wait for loading to complete

### 2. Start Camera

1. Click "Start Camera"
2. Grant camera permission when prompted
3. Camera preview appears
4. Verify you see your camera feed

### 3. Single-shot Analysis

1. Type a prompt: "What objects do you see?"
2. Click "Describe"
3. Wait 2-5 seconds for processing
4. Read the description

### 4. Live Mode

1. Click "Live" button
2. Watch as descriptions update every 2-3 seconds
3. Move camera around to see real-time analysis
4. Click "Stop Live" when done

**Tips:**
- Good lighting improves accuracy
- Point camera at distinct objects
- Try prompts like:
  - "What colors are prominent?"
  - "Are there any people?"
  - "Describe the scene in detail"

---

## Voice Tab Walkthrough

Test the full voice pipeline:

### 1. Load All Voice Models

1. Click **Voice** tab
2. Click "Click to load Voice models"
3. This loads 4 models:
   - VAD (5MB)
   - STT - Whisper Tiny (105MB)
   - LLM - LFM2-350M (if not already loaded)
   - TTS - Piper voice (65MB)
4. Wait for all models to load (~1-2 minutes first time)

### 2. Test Voice Interaction

1. Click "Start Listening"
2. See animated orb pulse with your voice
3. Speak clearly: "What is on-device AI?"
4. Stop speaking and wait
5. VAD detects silence and processes:
   - **Transcription appears** ("What is on-device AI?")
   - **LLM generates response** (streaming text)
   - **TTS synthesizes speech** (you hear the response)

### 3. Tips for Best Results

- **Speak clearly** - Natural pace, not too fast
- **Quiet environment** - Reduce background noise
- **Keep responses concise** - LLM is configured for short answers
- **Wait for silence** - VAD needs ~1 second of silence to trigger

---

## Tools Tab Walkthrough

Test function calling:

### 1. Try Built-in Tools

The app includes 4 demo tools:
- `get_weather` - Mock weather API
- `calculate` - Math expressions
- `get_time` - Current time in any timezone
- `random_number` - Random integer generator

### 2. Test Tool Calling

Try these prompts:

**Weather:**
```
"What's the weather in Tokyo?"
```
Watch the LLM:
1. Parse the request
2. Call `get_weather(location="Tokyo")`
3. Get result: `{ temperature_f: 72, condition: "Sunny" }`
4. Formulate response: "It's 72°F and sunny in Tokyo"

**Calculator:**
```
"What is 123 * 456?"
```
LLM calls `calculate(expression="123 * 456")` → returns `56088`

**Multi-tool:**
```
"What's the weather in London and what time is it there?"
```
LLM calls both `get_weather` and `get_time`

### 3. Register Custom Tool

1. Click "+ Add Tool"
2. Fill in form:
   - Name: `search_database`
   - Description: "Searches the product database"
   - Parameters:
     - query (string, required)
     - limit (number, optional)
3. Click "Register Tool"
4. Try: "Search database for laptops"

---

## Understanding the Codebase

### Key Files

```
src/
├── runanywhere.ts          # ⭐ SDK initialization & model catalog
├── App.tsx                 # Main app with tab navigation
├── components/
│   ├── ChatTab.tsx         # LLM streaming chat
│   ├── VisionTab.tsx       # Camera + VLM inference
│   ├── VoiceTab.tsx        # VAD → STT → LLM → TTS pipeline
│   ├── ToolsTab.tsx        # Tool calling demo
│   └── ModelBanner.tsx     # Download progress UI
├── hooks/
│   └── useModelLoader.ts   # Reusable model loading hook
└── workers/
    └── vlm-worker.ts       # VLM Web Worker
```

### Core Patterns

**1. Model Loading Hook**
```typescript
const loader = useModelLoader(ModelCategory.Language);

// States: 'idle' | 'downloading' | 'loading' | 'ready' | 'error'
if (loader.state === 'ready') {
  // Model is loaded, can use it
}

// Load model
await loader.ensure();
```

**2. Streaming Generation**
```typescript
const { stream, result, cancel } = await TextGeneration.generateStream(prompt, {
  maxTokens: 512,
  temperature: 0.7,
});

// Stream tokens
for await (const token of stream) {
  console.log(token);
}

// Get final metrics
const metrics = await result;
console.log(`${metrics.tokensPerSecond} tok/s`);
```

**3. Voice Pipeline**
```typescript
const pipeline = new VoicePipeline();

const result = await pipeline.processTurn(audioData, {
  maxTokens: 60,
  systemPrompt: 'Be concise.',
}, {
  onTranscription: (text) => console.log('You said:', text),
  onResponseToken: (token) => console.log(token),
  onSynthesisComplete: async (audio) => {
    // Play TTS audio
  },
});
```

---

## Next Steps

Now that you've tested all features:

### 1. Read the Documentation

- [ ] **[FEATURES_GUIDE.md](./FEATURES_GUIDE.md)** - Deep dive into each feature
- [ ] **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - API reference cheat sheet
- [ ] **[EXAMPLES.md](./EXAMPLES.md)** - Real-world code examples
- [ ] **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Common issues

### 2. Customize the App

**Easy Customizations:**
- [ ] Change model (edit `MODELS` array in `runanywhere.ts`)
- [ ] Adjust generation parameters (temperature, maxTokens)
- [ ] Modify system prompts
- [ ] Add custom tools
- [ ] Change UI theme (edit CSS)

**Medium Difficulty:**
- [ ] Add a new tab with custom functionality
- [ ] Implement chat history persistence (localStorage)
- [ ] Add markdown rendering for responses
- [ ] Create specialized assistants (code, creative, etc.)

**Advanced:**
- [ ] Integrate external APIs as tools
- [ ] Build agent workflows with multi-step reasoning
- [ ] Add RAG (retrieval-augmented generation)
- [ ] Implement voice wake-word detection

### 3. Deploy to Production

See [README.md - Deployment](./README.md#deployment) for:
- Vercel deployment
- Netlify deployment
- Custom hosting with COOP/COEP headers

---

## Common First-Time Issues

### "SDK initialization failed"

**Fix:** Check browser console for specific error. Usually:
- Old browser version (upgrade to Chrome/Edge 96+)
- Missing HTTPS (use `vite --https`)

### "Model download stuck at 0%"

**Fix:**
1. Check network connection
2. Check browser console for CORS errors
3. Try a different network (corporate networks may block HuggingFace)
4. Verify disk space available

### "Generation is very slow" (< 1 tok/s)

**Fix:**
1. Check acceleration mode (should be WebGPU)
2. Close other browser tabs to free memory
3. Try a smaller model (LFM2-350M is smallest)
4. Check if browser is throttling (laptop on battery)

### "Camera/microphone permission denied"

**Fix:**
1. Grant permission in browser settings
2. Check OS-level permissions (System Preferences on macOS)
3. Use HTTPS (required for media APIs)
4. Try private/incognito window

### "Out of memory" errors

**Fix:**
1. Use smaller models
2. Close other tabs/applications
3. Restart browser
4. Try on device with more RAM (need 4GB+)

---

## Getting Help

If you encounter issues:

1. **Check console** - Browser DevTools → Console tab
2. **Enable debug mode** - Set `debug: true` in `RunAnywhere.initialize()`
3. **Review troubleshooting** - See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
4. **Search issues** - [GitHub Issues](https://github.com/RunanywhereAI/runanywhere-sdks/issues)
5. **Report bug** - Include:
   - Browser version
   - OS version
   - Full console error
   - Steps to reproduce

---

## Checklist: You're Ready When...

- [ ] App loads without errors
- [ ] Can chat with LLM and get streaming responses
- [ ] Camera works and VLM describes images
- [ ] Voice pipeline works end-to-end
- [ ] Tool calling executes successfully
- [ ] Understand the basic code structure
- [ ] Read at least FEATURES_GUIDE.md
- [ ] Know where to find API reference (QUICK_REFERENCE.md)
- [ ] Can add a simple custom tool

---

## Resources

- [RunAnywhere Web Docs](https://docs.runanywhere.ai/web/introduction)
- [GitHub Repository](https://github.com/RunanywhereAI/runanywhere-sdks)
- [npm Package](https://www.npmjs.com/package/@runanywhere/web)
- [HuggingFace GGUF Models](https://huggingface.co/models?library=gguf)

---

**Welcome to on-device AI!** You now have a fully functional AI stack running entirely in the browser. No servers, no API keys, 100% private. Build something amazing! 🚀
