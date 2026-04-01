# RunAnywhere Web SDK - Troubleshooting Guide

Common issues and solutions when working with the RunAnywhere Web SDK.

## Table of Contents

- [Installation & Setup Issues](#installation--setup-issues)
- [Model Loading Issues](#model-loading-issues)
- [Generation Issues](#generation-issues)
- [Audio Issues (STT/TTS/VAD)](#audio-issues-stttsvad)
- [Camera/Vision Issues](#cameravision-issues)
- [Performance Issues](#performance-issues)
- [Tool Calling Issues](#tool-calling-issues)
- [Browser Compatibility](#browser-compatibility)

---

## Installation & Setup Issues

### SDK Fails to Initialize

**Symptoms:**
```
Error: SDK initialization failed
```

**Solutions:**

1. Check that all packages are installed:
```bash
npm list @runanywhere/web @runanywhere/web-llamacpp @runanywhere/web-onnx
```

2. Verify initialization order:
```typescript
// ✓ Correct order
await RunAnywhere.initialize();
await LlamaCPP.register();
await ONNX.register();

// ✗ Wrong - registering before init
await LlamaCPP.register(); // Will fail
await RunAnywhere.initialize();
```

3. Check browser console for specific errors

4. Ensure HTTPS (required for many Web APIs):
```bash
# Use Vite's built-in HTTPS
vite --host --https
```

### WASM Module Fails to Load

**Symptoms:**
```
Failed to load WASM module
TypeError: Failed to fetch
```

**Solutions:**

1. Check CORS headers if serving WASM from CDN:
```typescript
// vite.config.ts
export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
});
```

2. Verify file paths in browser Network tab

3. Check Content-Type header for .wasm files:
```
Content-Type: application/wasm
```

4. Clear browser cache and try again

### TypeScript Errors

**Symptoms:**
```
Cannot find module '@runanywhere/web'
TS2307: Cannot find module
```

**Solutions:**

1. Restart TypeScript server (VS Code: `Ctrl+Shift+P` → "Restart TS Server")

2. Check tsconfig.json:
```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "skipLibCheck": true
  }
}
```

3. Verify package.json has correct versions:
```json
{
  "dependencies": {
    "@runanywhere/web": "0.1.0-beta.10",
    "@runanywhere/web-llamacpp": "0.1.0-beta.10",
    "@runanywhere/web-onnx": "0.1.0-beta.10"
  }
}
```

---

## Model Loading Issues

### Model Not Found

**Symptoms:**
```
Error: Model 'my-model' not found
```

**Solutions:**

1. Check model is registered:
```typescript
const models = RunAnywhere.getAvailableModels();
console.log('Available models:', models.map(m => m.id));
```

2. Verify model definition in `runanywhere.ts`:
```typescript
const MODELS: CompactModelDef[] = [
  {
    id: 'my-model', // Must match ID used in loadModel()
    name: 'My Model',
    // ... rest of config
  },
];

RunAnywhere.registerModels(MODELS);
```

3. Ensure model ID is correct (case-sensitive)

### Download Fails or Stalls

**Symptoms:**
- Download progress stuck at 0%
- Download fails with network error
- Download never completes

**Solutions:**

1. Check network connectivity

2. Verify model URL is accessible:
```typescript
// Test URL directly in browser
const url = 'https://huggingface.co/...';
fetch(url).then(r => console.log('Status:', r.status));
```

3. Check available disk space:
```typescript
if ('storage' in navigator && 'estimate' in navigator.storage) {
  const estimate = await navigator.storage.estimate();
  console.log('Free space:', estimate.quota - estimate.usage);
}
```

4. Use a smaller model for testing:
```typescript
// LFM2-350M is only ~250MB
await ModelManager.loadModel('lfm2-350m-q4_k_m');
```

5. Clear OPFS storage and retry:
```typescript
// Clear all stored models
const models = await ModelManager.getDownloadedModels();
for (const modelId of models) {
  await ModelManager.deleteModel(modelId);
}
```

### Model Loads but Crashes

**Symptoms:**
```
RuntimeError: memory access out of bounds
Uncaught (in promise) RuntimeError
```

**Solutions:**

1. **Insufficient memory** - Use a smaller model:
```typescript
// Instead of 1.2B model
'lfm2-1.2b-tool-q4_k_m' // ~800MB

// Try 350M model
'lfm2-350m-q4_k_m' // ~250MB
```

2. **Corrupted download** - Delete and re-download:
```typescript
await ModelManager.deleteModel('model-id');
await ModelManager.loadModel('model-id'); // Will re-download
```

3. **Browser memory limit** - Close other tabs/apps

4. Check browser console for specific WASM error

---

## Generation Issues

### No Output Generated

**Symptoms:**
- Generation completes but returns empty string
- Stream yields no tokens

**Solutions:**

1. Check model is actually loaded:
```typescript
const loaded = ModelManager.getLoadedModel(ModelCategory.Language);
if (!loaded) {
  await ModelManager.loadModel('model-id');
}
```

2. Verify prompt is not empty:
```typescript
const prompt = userInput.trim();
if (!prompt) {
  console.error('Empty prompt');
  return;
}
```

3. Try higher maxTokens:
```typescript
// Too low - might not generate anything
maxTokens: 10

// Better
maxTokens: 100
```

4. Check for stop sequences that trigger too early:
```typescript
// Problematic
stopSequences: ['\n'] // Stops at first newline

// Better
stopSequences: ['\n\n'] // Stops at paragraph break
```

### Generation is Nonsensical

**Symptoms:**
- Output is gibberish or random characters
- Responses don't make sense

**Solutions:**

1. **Temperature too high** - Reduce temperature:
```typescript
temperature: 0.7  // Default
temperature: 0.3  // More focused
temperature: 0.1  // Very deterministic
```

2. **Wrong model** - Verify correct model loaded:
```typescript
const loaded = ModelManager.getLoadedModel(ModelCategory.Language);
console.log('Loaded model:', loaded?.id);
```

3. **System prompt conflict** - Review system prompt:
```typescript
// Bad - contradictory
systemPrompt: 'You are helpful. You are mean.'

// Good - clear instruction
systemPrompt: 'You are a helpful assistant. Be concise and accurate.'
```

4. **Context too long** - Shorten conversation history:
```typescript
// Keep only last 5 messages
const recentMessages = messages.slice(-5);
```

### Generation is Too Slow

**Symptoms:**
- Takes >10 seconds for short responses
- Tokens/second is < 1

**Solutions:**

1. **Use smaller model**:
```typescript
// Slow: 1.2B parameters
'lfm2-1.2b-tool-q4_k_m'

// Fast: 350M parameters
'lfm2-350m-q4_k_m'
```

2. **Enable WebGPU** - Check acceleration:
```typescript
const accel = LlamaCPP.accelerationMode;
console.log('Acceleration:', accel);

// If 'cpu', enable COOP/COEP headers for WebGPU
```

3. **Reduce maxTokens**:
```typescript
maxTokens: 500  // Slower
maxTokens: 100  // Faster
```

4. **Lower temperature** (slightly faster):
```typescript
temperature: 0.3  // Faster than 0.9
```

5. **Test on different device** - Performance varies greatly by hardware

---

## Audio Issues (STT/TTS/VAD)

### Microphone Permission Denied

**Symptoms:**
```
NotAllowedError: Permission denied
DOMException: Permission denied
```

**Solutions:**

1. Check browser permissions:
   - Chrome: `chrome://settings/content/microphone`
   - Check site-specific permissions

2. Request permission explicitly:
```typescript
try {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach(track => track.stop());
  console.log('Permission granted');
} catch (err) {
  console.error('Permission denied:', err);
}
```

3. Use HTTPS (required for microphone access):
```bash
vite --host --https
```

4. Check OS-level permissions (macOS System Settings → Privacy → Microphone)

### STT Produces No Transcription

**Symptoms:**
- Audio captured but no text output
- Empty transcription result

**Solutions:**

1. **Audio too short**:
```typescript
// Minimum ~0.1 seconds (1600 samples at 16kHz)
if (audioData.length < 1600) {
  console.error('Audio too short');
  return;
}
```

2. **Wrong sample rate**:
```typescript
// STT expects 16kHz
const mic = new AudioCapture({ sampleRate: 16000 }); // ✓
const mic = new AudioCapture({ sampleRate: 44100 }); // ✗
```

3. **STT model not loaded**:
```typescript
const sttModel = ModelManager.getLoadedModel(ModelCategory.SpeechRecognition);
if (!sttModel) {
  await ModelManager.loadSTTModel('sherpa-onnx-whisper-tiny.en');
}
```

4. **Audio is silence** - Test with actual speech

5. **Check audio format**:
```typescript
// Should be Float32Array, mono, 16kHz
console.log('Audio:', audioData.constructor.name, audioData.length);
```

### TTS Produces No Sound

**Symptoms:**
- TTS synthesis completes but no audio plays
- Audio buffer is empty

**Solutions:**

1. **TTS model not loaded**:
```typescript
const ttsModel = ModelManager.getLoadedModel(ModelCategory.SpeechSynthesis);
if (!ttsModel) {
  await ModelManager.loadTTSVoice('vits-piper-en_US-lessac-medium');
}
```

2. **Text is empty**:
```typescript
const text = inputText.trim();
if (!text) {
  console.error('Empty text');
  return;
}
```

3. **Audio playback issue**:
```typescript
try {
  const result = await TTS.synthesize('Hello');
  console.log('Audio samples:', result.audio.length);
  console.log('Sample rate:', result.sampleRate);
  
  const player = new AudioPlayback({ sampleRate: result.sampleRate });
  await player.play(result.audio, result.sampleRate);
  player.dispose();
} catch (err) {
  console.error('Playback error:', err);
}
```

4. **Browser audio context suspended** - User interaction required:
```typescript
// Resume audio context on user gesture
document.addEventListener('click', async () => {
  const ctx = new AudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
}, { once: true });
```

### VAD Not Detecting Speech

**Symptoms:**
- No speech events triggered
- VAD always reports silence

**Solutions:**

1. **Audio level too low** - Increase microphone volume

2. **VAD not initialized**:
```typescript
VAD.reset(); // Call before starting
```

3. **Check audio level callback**:
```typescript
await mic.start(
  (chunk) => { VAD.processSamples(chunk); },
  (level) => { console.log('Audio level:', level); } // Should be > 0
);
```

4. **Wrong sample rate**:
```typescript
// VAD expects 16kHz
const mic = new AudioCapture({ sampleRate: 16000 });
```

5. **Adjust sensitivity** - If VAD module supports it, lower threshold

---

## Camera/Vision Issues

### Camera Permission Denied

**Symptoms:**
```
NotAllowedError: Permission denied
NotFoundError: Requested device not found
```

**Solutions:**

1. Grant camera permission in browser

2. Check OS-level camera permissions

3. Verify camera is not in use:
   - Close other apps using camera
   - Restart browser

4. Try different camera (if multiple available):
```typescript
const cam = new VideoCapture({ facingMode: 'user' }); // Front camera
const cam = new VideoCapture({ facingMode: 'environment' }); // Back camera
```

5. Use HTTPS (required for camera access)

### VLM Model Not Loading

**Symptoms:**
```
Error: VLM model not loaded
Worker initialization failed
```

**Solutions:**

1. **Check VLM worker setup**:
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

2. **Check worker file exists**:
```typescript
// Should be generated by Vite
import vlmWorkerUrl from './workers/vlm-worker?worker&url';
console.log('Worker URL:', vlmWorkerUrl);
```

3. **Verify VLM model is registered**:
```typescript
const models = RunAnywhere.getAvailableModels();
const vlmModel = models.find(m => m.modality === ModelCategory.Multimodal);
console.log('VLM model:', vlmModel);
```

4. **Load VLM model explicitly**:
```typescript
await ModelManager.loadModel('lfm2-vl-450m-q4_0');
```

### VLM Output is Incorrect

**Symptoms:**
- Describes wrong objects
- Hallucinates content not in image
- Very generic descriptions

**Solutions:**

1. **Improve prompt**:
```typescript
// Bad - vague
'What do you see?'

// Good - specific
'List all objects in this image with their colors and positions.'
```

2. **Lower temperature**:
```typescript
temperature: 0.6  // Default
temperature: 0.3  // More accurate
```

3. **Increase image resolution**:
```typescript
const frame = cam.captureFrame(256);  // Default
const frame = cam.captureFrame(512);  // Higher quality (but slower)
```

4. **Better lighting** - Ensure image is well-lit

5. **Try different VLM model** if available

---

## Performance Issues

### Slow Initial Load

**Symptoms:**
- App takes 10+ seconds to become ready
- White screen on startup

**Solutions:**

1. **Show loading indicator**:
```typescript
<div className="loading">
  <div className="spinner" />
  <p>Loading AI engine...</p>
</div>
```

2. **Defer model loading**:
```typescript
// Don't load models on startup
await RunAnywhere.initialize();
await LlamaCPP.register();
// Wait for user to request feature before loading model
```

3. **Use code splitting**:
```typescript
// Lazy load components
const VoiceTab = lazy(() => import('./components/VoiceTab'));
```

4. **Optimize bundle size**:
```bash
npm run build -- --analyze
```

### High Memory Usage

**Symptoms:**
- Browser becomes sluggish
- Tab crashes with "Out of memory"
- Device overheats

**Solutions:**

1. **Use smaller models**:
```typescript
// 350M parameters instead of 1.2B
'lfm2-350m-q4_k_m'
```

2. **Unload unused models**:
```typescript
// After using STT, if switching to LLM only
await ModelManager.unloadSTTModel();
await ModelManager.unloadTTSVoice();
```

3. **Clear old data**:
```typescript
// Clear conversation history
messages = messages.slice(-10); // Keep last 10 only

// Clear localStorage
localStorage.clear();
```

4. **Monitor memory**:
```typescript
if (performance.memory) {
  console.log('Heap used:', performance.memory.usedJSHeapSize / 1024 / 1024, 'MB');
  console.log('Heap limit:', performance.memory.jsHeapSizeLimit / 1024 / 1024, 'MB');
}
```

### Laggy UI During Generation

**Symptoms:**
- UI freezes while generating
- Can't scroll or interact during generation

**Solutions:**

1. **Use streaming** (non-blocking):
```typescript
// Blocks UI
const result = await TextGeneration.generate(prompt);

// Non-blocking (better)
const { stream } = await TextGeneration.generateStream(prompt);
for await (const token of stream) {
  updateUI(token);
  await new Promise(r => setTimeout(r, 0)); // Yield to UI
}
```

2. **Use Web Worker** (VLM already does this)

3. **Reduce UI updates**:
```typescript
// Bad - updates every token
for await (const token of stream) {
  setState(prev => prev + token); // Triggers re-render
}

// Better - batch updates
let buffer = '';
for await (const token of stream) {
  buffer += token;
  if (buffer.length > 10) { // Update every 10 chars
    setState(prev => prev + buffer);
    buffer = '';
  }
}
```

---

## Tool Calling Issues

### Tools Not Being Called

**Symptoms:**
- LLM responds but doesn't use tools
- `toolCalls` array is empty

**Solutions:**

1. **Check tools are registered**:
```typescript
const tools = ToolCalling.getRegisteredTools();
console.log('Registered tools:', tools.map(t => t.name));
```

2. **Improve tool descriptions**:
```typescript
// Bad - vague
description: 'Gets weather'

// Good - specific
description: 'Gets the current weather for a city. Returns temperature in Fahrenheit and conditions.'
```

3. **Use tool-optimized model**:
```typescript
// LFM2 1.2B Tool is specifically trained for tool calling
await ModelManager.loadModel('lfm2-1.2b-tool-q4_k_m');
```

4. **Lower temperature**:
```typescript
temperature: 0.9  // Too high for tool calling
temperature: 0.3  // Better for structured output
```

5. **Make query more explicit**:
```typescript
// Bad - ambiguous
'What's it like in Tokyo?'

// Good - clearly needs weather tool
'Get the current weather for Tokyo'
```

### Tool Execution Fails

**Symptoms:**
```
Error executing tool
Tool result is undefined
```

**Solutions:**

1. **Check tool executor returns correct format**:
```typescript
// Must return Record<string, ToolValue>
const executor = async (args: Record<string, ToolValue>) => {
  return {
    result: toToolValue('success'), // ✓ Use toToolValue()
    // result: 'success', // ✗ Wrong format
  };
};
```

2. **Handle errors in executor**:
```typescript
const executor = async (args) => {
  try {
    const result = await doSomething();
    return { result: toToolValue(result) };
  } catch (err) {
    return { error: toToolValue(err.message) };
  }
};
```

3. **Validate arguments**:
```typescript
const executor = async (args) => {
  const location = getStringArg(args, 'location');
  if (!location) {
    return { error: toToolValue('Missing location parameter') };
  }
  // ... rest of logic
};
```

---

## Browser Compatibility

### Feature Detection

Always check if features are available:

```typescript
// Check Web Audio API
if (!window.AudioContext && !window.webkitAudioContext) {
  console.error('Web Audio API not supported');
}

// Check getUserMedia
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
  console.error('getUserMedia not supported');
}

// Check OPFS
if (!('storage' in navigator) || !('getDirectory' in navigator.storage)) {
  console.error('OPFS not supported');
}

// Check WebAssembly
if (typeof WebAssembly === 'undefined') {
  console.error('WebAssembly not supported');
}
```

### Safari-Specific Issues

**Issue:** SharedArrayBuffer not available

**Solution:** Set COOP/COEP headers:
```typescript
// vite.config.ts
headers: {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}
```

**Issue:** Audio context suspended by default

**Solution:** Resume on user interaction:
```typescript
document.addEventListener('click', async () => {
  const ctx = new AudioContext();
  await ctx.resume();
}, { once: true });
```

---

## Getting Help

If you're still stuck:

1. **Check browser console** - Often has detailed error messages

2. **Enable debug mode**:
```typescript
await RunAnywhere.initialize({
  environment: SDKEnvironment.Development,
  debug: true,
});
```

3. **Create minimal reproduction**:
```typescript
// Simplest possible case that reproduces the issue
await RunAnywhere.initialize();
await LlamaCPP.register();
await ModelManager.loadModel('lfm2-350m-q4_k_m');
const result = await TextGeneration.generate('Hello');
console.log(result);
```

4. **Check GitHub Issues**: https://github.com/RunanywhereAI/runanywhere-sdks/issues

5. **Report bug with**:
   - Browser version
   - OS version
   - Minimal code reproduction
   - Console errors (full stack trace)
   - SDK version from package.json

---

## Debug Checklist

Before reporting an issue, verify:

- [ ] Using HTTPS (required for camera/microphone)
- [ ] All packages installed with matching versions
- [ ] SDK initialized before using features
- [ ] Models registered and loaded
- [ ] Browser console checked for errors
- [ ] Tried in Chrome/Edge (most compatible)
- [ ] Sufficient disk space (2-5GB for models)
- [ ] Sufficient RAM (4GB+ recommended)
- [ ] Issue reproduces in private/incognito window
- [ ] Tried smaller model to isolate memory issues

---

For more information, see:
- [Features Guide](./FEATURES_GUIDE.md)
- [Quick Reference](./QUICK_REFERENCE.md)
- [Examples](./EXAMPLES.md)
