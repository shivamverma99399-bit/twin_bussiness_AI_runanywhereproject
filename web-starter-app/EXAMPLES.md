# RunAnywhere Web SDK - Practical Examples

Real-world examples and recipes for building AI features with the RunAnywhere Web SDK.

## Table of Contents

- [Chat Applications](#chat-applications)
- [Voice Applications](#voice-applications)
- [Vision Applications](#vision-applications)
- [Agent Systems](#agent-systems)
- [Accessibility Features](#accessibility-features)
- [Creative Tools](#creative-tools)

---

## Chat Applications

### 1. Multi-turn Conversation with History

```typescript
interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
}

class ConversationManager {
  private messages: Message[] = [];
  private maxHistory = 10; // Keep last 10 messages for context

  addMessage(role: 'user' | 'assistant', content: string) {
    this.messages.push({
      role,
      content,
      timestamp: Date.now(),
    });
  }

  buildPrompt(userMessage: string, systemPrompt?: string): string {
    const history = this.messages.slice(-this.maxHistory);
    const parts: string[] = [];

    if (systemPrompt) {
      parts.push(`System: ${systemPrompt}`);
    }

    history.forEach(msg => {
      parts.push(`${msg.role}: ${msg.content}`);
    });

    parts.push(`user: ${userMessage}`);
    parts.push('assistant:');

    return parts.join('\n\n');
  }

  clear() {
    this.messages = [];
  }

  exportHistory(): string {
    return JSON.stringify(this.messages, null, 2);
  }
}

// Usage
const conversation = new ConversationManager();

const chat = async (userMessage: string) => {
  const prompt = conversation.buildPrompt(userMessage, 'You are a helpful assistant.');
  
  const { stream, result } = await TextGeneration.generateStream(prompt, {
    maxTokens: 200,
    temperature: 0.7,
  });

  let response = '';
  for await (const token of stream) {
    response += token;
    updateUI(response);
  }

  conversation.addMessage('user', userMessage);
  conversation.addMessage('assistant', response);

  return response;
};
```

### 2. Code Assistant with Syntax Highlighting

```typescript
import { Prism } from 'prismjs';

const CODE_SYSTEM_PROMPT = `You are an expert programming assistant.
- Write clean, well-commented code
- Explain your approach
- Handle edge cases
- Use best practices`;

const extractCodeBlocks = (text: string) => {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks: { language: string; code: string }[] = [];
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    blocks.push({
      language: match[1] || 'javascript',
      code: match[2].trim(),
    });
  }

  return blocks;
};

const CodeAssistant = () => {
  const [response, setResponse] = useState('');
  const [codeBlocks, setCodeBlocks] = useState<Array<{ language: string; code: string }>>([]);

  const askCode = async (question: string) => {
    const { stream } = await TextGeneration.generateStream(question, {
      systemPrompt: CODE_SYSTEM_PROMPT,
      temperature: 0.3, // Lower for more deterministic code
      maxTokens: 500,
    });

    let accumulated = '';
    for await (const token of stream) {
      accumulated += token;
      setResponse(accumulated);

      // Extract code blocks as they appear
      const blocks = extractCodeBlocks(accumulated);
      setCodeBlocks(blocks);
    }
  };

  return (
    <div>
      <div dangerouslySetInnerHTML={{ __html: response }} />
      
      {codeBlocks.map((block, i) => (
        <pre key={i}>
          <code 
            className={`language-${block.language}`}
            dangerouslySetInnerHTML={{
              __html: Prism.highlight(block.code, Prism.languages[block.language], block.language)
            }}
          />
          <button onClick={() => navigator.clipboard.writeText(block.code)}>
            Copy
          </button>
        </pre>
      ))}
    </div>
  );
};
```

### 3. Auto-completion / Suggestion System

```typescript
class AutoComplete {
  private debounceTimer: NodeJS.Timeout | null = null;

  async getSuggestion(
    text: string, 
    cursorPosition: number,
    onSuggestion: (suggestion: string) => void
  ) {
    // Debounce to avoid too many requests
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    this.debounceTimer = setTimeout(async () => {
      const prefix = text.slice(0, cursorPosition);
      const suffix = text.slice(cursorPosition);

      const prompt = `Complete the following text naturally:\n\n${prefix}`;

      const { stream } = await TextGeneration.generateStream(prompt, {
        maxTokens: 50,
        temperature: 0.4,
        stopSequences: ['\n\n', suffix.trim()],
      });

      let suggestion = '';
      for await (const token of stream) {
        suggestion += token;
        onSuggestion(suggestion);
      }
    }, 500); // Wait 500ms after user stops typing
  }

  cancel() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}

// Usage in a text editor
const Editor = () => {
  const [text, setText] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const autoComplete = useRef(new AutoComplete());

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);

    // Get suggestion
    autoComplete.current.getSuggestion(
      newText,
      e.target.selectionStart,
      setSuggestion
    );
  };

  return (
    <div style={{ position: 'relative' }}>
      <textarea 
        value={text} 
        onChange={handleTextChange}
      />
      {suggestion && (
        <div className="suggestion-overlay">
          <span className="suggestion-text">{suggestion}</span>
        </div>
      )}
    </div>
  );
};
```

---

## Voice Applications

### 1. Voice Commands System

```typescript
const COMMANDS = {
  'start timer': /start (?:a )?timer for (\d+) (seconds?|minutes?|hours?)/i,
  'set reminder': /remind me to (.+) (?:in|at) (.+)/i,
  'play music': /play (.+)/i,
  'search': /search (?:for )?(.+)/i,
};

class VoiceCommandProcessor {
  async processCommand(transcript: string): Promise<string> {
    transcript = transcript.toLowerCase().trim();

    // Check for timer command
    const timerMatch = transcript.match(COMMANDS['start timer']);
    if (timerMatch) {
      const [, duration, unit] = timerMatch;
      return this.startTimer(parseInt(duration), unit);
    }

    // Check for reminder
    const reminderMatch = transcript.match(COMMANDS['set reminder']);
    if (reminderMatch) {
      const [, task, time] = reminderMatch;
      return this.setReminder(task, time);
    }

    // Check for music
    const musicMatch = transcript.match(COMMANDS['play music']);
    if (musicMatch) {
      const [, song] = musicMatch;
      return this.playMusic(song);
    }

    // Check for search
    const searchMatch = transcript.match(COMMANDS['search']);
    if (searchMatch) {
      const [, query] = searchMatch;
      return this.search(query);
    }

    // Fallback to LLM for general queries
    return this.askLLM(transcript);
  }

  private async startTimer(duration: number, unit: string): Promise<string> {
    const ms = this.convertToMs(duration, unit);
    setTimeout(() => alert('Timer finished!'), ms);
    return `Timer set for ${duration} ${unit}`;
  }

  private async setReminder(task: string, time: string): Promise<string> {
    // Implementation
    return `Reminder set: ${task} at ${time}`;
  }

  private async playMusic(song: string): Promise<string> {
    // Implementation
    return `Playing ${song}`;
  }

  private async search(query: string): Promise<string> {
    // Implementation
    return `Searching for ${query}`;
  }

  private async askLLM(query: string): Promise<string> {
    const result = await TextGeneration.generate(query, {
      maxTokens: 100,
      temperature: 0.7,
      systemPrompt: 'You are a helpful voice assistant. Be very concise.',
    });
    return result.text;
  }

  private convertToMs(duration: number, unit: string): number {
    const multipliers: Record<string, number> = {
      second: 1000,
      seconds: 1000,
      minute: 60000,
      minutes: 60000,
      hour: 3600000,
      hours: 3600000,
    };
    return duration * (multipliers[unit] || 1000);
  }
}
```

### 2. Voice-to-Voice Translation

```typescript
class VoiceTranslator {
  private sourceLanguage = 'en';
  private targetLanguage = 'es';

  async translateVoice(audioData: Float32Array): Promise<Float32Array> {
    // 1. Transcribe (STT)
    const transcript = await STT.transcribe(audioData, {
      language: this.sourceLanguage,
    });

    console.log(`Original (${this.sourceLanguage}):`, transcript.text);

    // 2. Translate (LLM)
    const translation = await this.translate(transcript.text);
    console.log(`Translated (${this.targetLanguage}):`, translation);

    // 3. Synthesize (TTS)
    const ttsResult = await TTS.synthesize(translation, {
      speed: 1.0,
    });

    return ttsResult.audio;
  }

  private async translate(text: string): Promise<string> {
    const prompt = `Translate the following ${this.sourceLanguage} text to ${this.targetLanguage}. Only output the translation, nothing else:\n\n${text}`;

    const result = await TextGeneration.generate(prompt, {
      maxTokens: 200,
      temperature: 0.3, // Lower temp for accurate translation
    });

    return result.text.trim();
  }

  setLanguages(source: string, target: string) {
    this.sourceLanguage = source;
    this.targetLanguage = target;
  }
}

// Usage
const translator = new VoiceTranslator();
translator.setLanguages('en', 'es');

VAD.onSpeechActivity(async (activity) => {
  if (activity === SpeechActivity.Ended) {
    const segment = VAD.popSpeechSegment();
    if (segment) {
      const translatedAudio = await translator.translateVoice(segment.samples);
      
      // Play translated audio
      const player = new AudioPlayback({ sampleRate: 22050 });
      await player.play(translatedAudio, 22050);
      player.dispose();
    }
  }
});
```

### 3. Meeting Transcription with Speaker Diarization

```typescript
interface TranscriptSegment {
  speaker: string;
  text: string;
  timestamp: number;
  confidence: number;
}

class MeetingTranscriber {
  private segments: TranscriptSegment[] = [];
  private currentSpeaker = 'Speaker 1';
  private speakerChangeThreshold = 3000; // 3 seconds
  private lastSegmentTime = 0;

  async startRecording() {
    const mic = new AudioCapture({ sampleRate: 16000 });
    VAD.reset();

    VAD.onSpeechActivity(async (activity) => {
      if (activity === SpeechActivity.Ended) {
        const segment = VAD.popSpeechSegment();
        if (segment) {
          await this.processSegment(segment.samples);
        }
      }
    });

    await mic.start(
      (chunk) => VAD.processSamples(chunk),
      (level) => console.log('Audio level:', level)
    );
  }

  private async processSegment(audioData: Float32Array) {
    const now = Date.now();

    // Detect speaker change based on silence gap
    if (now - this.lastSegmentTime > this.speakerChangeThreshold) {
      this.currentSpeaker = this.toggleSpeaker(this.currentSpeaker);
    }

    // Transcribe
    const result = await STT.transcribe(audioData);

    // Add segment
    this.segments.push({
      speaker: this.currentSpeaker,
      text: result.text,
      timestamp: now,
      confidence: 1.0,
    });

    this.lastSegmentTime = now;

    console.log(`[${this.currentSpeaker}] ${result.text}`);
  }

  private toggleSpeaker(current: string): string {
    const num = parseInt(current.split(' ')[1]);
    return `Speaker ${num === 1 ? 2 : 1}`;
  }

  exportTranscript(): string {
    return this.segments
      .map(s => `[${new Date(s.timestamp).toLocaleTimeString()}] ${s.speaker}: ${s.text}`)
      .join('\n');
  }

  async summarize(): Promise<string> {
    const transcript = this.segments
      .map(s => `${s.speaker}: ${s.text}`)
      .join('\n');

    const prompt = `Summarize the following meeting transcript in bullet points:\n\n${transcript}`;

    const result = await TextGeneration.generate(prompt, {
      maxTokens: 300,
      temperature: 0.5,
    });

    return result.text;
  }
}
```

---

## Vision Applications

### 1. Real-time Object Counter

```typescript
class ObjectCounter {
  private cam: VideoCapture | null = null;
  private bridge = VLMWorkerBridge.shared;
  private interval: ReturnType<typeof setInterval> | null = null;

  async start(onCount: (objects: Record<string, number>) => void) {
    this.cam = new VideoCapture({ facingMode: 'environment' });
    await this.cam.start();

    // Count every 3 seconds
    this.interval = setInterval(async () => {
      const frame = this.cam!.captureFrame(256);
      if (!frame) return;

      const result = await this.bridge.process(
        frame.rgbPixels,
        frame.width,
        frame.height,
        'List all objects you see, one per line. Format: "object_name"',
        { maxTokens: 100, temperature: 0.3 }
      );

      const counts = this.parseObjectList(result.text);
      onCount(counts);
    }, 3000);
  }

  private parseObjectList(text: string): Record<string, number> {
    const lines = text.split('\n').filter(l => l.trim());
    const counts: Record<string, number> = {};

    lines.forEach(line => {
      const object = line.trim().toLowerCase().replace(/[^a-z ]/g, '');
      if (object) {
        counts[object] = (counts[object] || 0) + 1;
      }
    });

    return counts;
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.cam?.stop();
  }
}

// Usage
const counter = new ObjectCounter();
await counter.start((counts) => {
  console.log('Object counts:', counts);
  // { "person": 2, "laptop": 1, "coffee cup": 1 }
});
```

### 2. Document Scanner with Text Extraction

```typescript
class DocumentScanner {
  async scanDocument(imageData: { 
    rgbPixels: Uint8Array; 
    width: number; 
    height: number;
  }): Promise<{
    text: string;
    confidence: number;
    metadata: {
      documentType: string;
      language: string;
    };
  }> {
    const bridge = VLMWorkerBridge.shared;

    // Extract text
    const textResult = await bridge.process(
      imageData.rgbPixels,
      imageData.width,
      imageData.height,
      'Extract all text from this document. Output only the text, exactly as written.',
      { maxTokens: 500, temperature: 0.1 }
    );

    // Detect document type
    const typeResult = await bridge.process(
      imageData.rgbPixels,
      imageData.width,
      imageData.height,
      'What type of document is this? (invoice, receipt, form, letter, etc.) Answer in one word.',
      { maxTokens: 10, temperature: 0.1 }
    );

    return {
      text: textResult.text,
      confidence: 0.9,
      metadata: {
        documentType: typeResult.text.trim().toLowerCase(),
        language: 'en',
      },
    };
  }

  async extractFields(documentText: string, fields: string[]): Promise<Record<string, string>> {
    const prompt = `Extract the following fields from this document text:\n\nFields: ${fields.join(', ')}\n\nDocument:\n${documentText}\n\nOutput as JSON: {"field": "value"}`;

    const result = await TextGeneration.generate(prompt, {
      maxTokens: 200,
      temperature: 0.1,
    });

    try {
      return JSON.parse(result.text);
    } catch {
      return {};
    }
  }
}

// Usage
const scanner = new DocumentScanner();

// Scan receipt
const cam = new VideoCapture({ facingMode: 'environment' });
await cam.start();
const frame = cam.captureFrame(512); // Higher res for text

const scanResult = await scanner.scanDocument(frame);
console.log('Text:', scanResult.text);
console.log('Type:', scanResult.metadata.documentType);

// Extract specific fields
if (scanResult.metadata.documentType === 'receipt') {
  const fields = await scanner.extractFields(scanResult.text, [
    'total',
    'date',
    'merchant',
    'items',
  ]);
  console.log('Extracted:', fields);
}
```

### 3. Visual Question Answering

```typescript
class VisualQA {
  private imageHistory: Array<{
    id: string;
    pixels: Uint8Array;
    width: number;
    height: number;
    timestamp: number;
  }> = [];

  captureImage(pixels: Uint8Array, width: number, height: number): string {
    const id = `img_${Date.now()}`;
    this.imageHistory.push({ id, pixels, width, height, timestamp: Date.now() });
    return id;
  }

  async ask(imageId: string, question: string): Promise<string> {
    const image = this.imageHistory.find(img => img.id === imageId);
    if (!image) throw new Error('Image not found');

    const bridge = VLMWorkerBridge.shared;
    const result = await bridge.process(
      image.pixels,
      image.width,
      image.height,
      question,
      { maxTokens: 150, temperature: 0.6 }
    );

    return result.text;
  }

  async compare(imageId1: string, imageId2: string, question: string): Promise<string> {
    const answer1 = await this.ask(imageId1, question);
    const answer2 = await this.ask(imageId2, question);

    const prompt = `Compare these two descriptions:\n\nImage 1: ${answer1}\n\nImage 2: ${answer2}\n\nQuestion: ${question}\n\nProvide a comparative analysis.`;

    const result = await TextGeneration.generate(prompt, {
      maxTokens: 200,
      temperature: 0.6,
    });

    return result.text;
  }
}

// Usage
const qa = new VisualQA();

// Capture two images
const cam = new VideoCapture({ facingMode: 'environment' });
await cam.start();

const frame1 = cam.captureFrame(256);
const id1 = qa.captureImage(frame1.rgbPixels, frame1.width, frame1.height);

await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds

const frame2 = cam.captureFrame(256);
const id2 = qa.captureImage(frame2.rgbPixels, frame2.width, frame2.height);

// Ask questions
console.log(await qa.ask(id1, 'What colors are prominent in this image?'));
console.log(await qa.compare(id1, id2, 'What changed between these two images?'));
```

---

## Agent Systems

### 1. Research Agent with Tool Chaining

```typescript
// Register research tools
ToolCalling.registerTool({
  name: 'search_web',
  description: 'Searches the web for information',
  parameters: [
    { name: 'query', type: 'string', description: 'Search query', required: true },
  ],
}, async (args) => {
  const query = getStringArg(args, 'query') ?? '';
  // Mock implementation
  const results = await mockWebSearch(query);
  return { results: toToolValue(JSON.stringify(results)) };
});

ToolCalling.registerTool({
  name: 'summarize_text',
  description: 'Summarizes a long text into key points',
  parameters: [
    { name: 'text', type: 'string', description: 'Text to summarize', required: true },
  ],
}, async (args) => {
  const text = getStringArg(args, 'text') ?? '';
  const result = await TextGeneration.generate(
    `Summarize in 3 bullet points:\n\n${text}`,
    { maxTokens: 150, temperature: 0.5 }
  );
  return { summary: toToolValue(result.text) };
});

ToolCalling.registerTool({
  name: 'save_findings',
  description: 'Saves research findings to storage',
  parameters: [
    { name: 'title', type: 'string', description: 'Title', required: true },
    { name: 'content', type: 'string', description: 'Content', required: true },
  ],
}, async (args) => {
  const title = getStringArg(args, 'title') ?? '';
  const content = getStringArg(args, 'content') ?? '';
  localStorage.setItem(`research_${Date.now()}`, JSON.stringify({ title, content }));
  return { status: toToolValue('saved'), id: toToolValue(Date.now().toString()) };
});

// Research agent
class ResearchAgent {
  async research(topic: string): Promise<string> {
    const systemPrompt = `You are a research assistant. Follow these steps:
1. Search for information about the topic
2. Summarize the findings
3. Save the research

Be thorough and use multiple searches if needed.`;

    const result = await ToolCalling.generateWithTools(
      `Research the topic: "${topic}"`,
      {
        autoExecute: true,
        maxToolCalls: 10,
        temperature: 0.3,
        systemPrompt,
      }
    );

    console.log('Tools called:', result.toolCalls.length);
    result.toolCalls.forEach((call, i) => {
      console.log(`${i + 1}. ${call.toolName}(${JSON.stringify(call.arguments)})`);
    });

    return result.text;
  }
}

// Usage
const agent = new ResearchAgent();
const findings = await agent.research('quantum computing applications');
console.log(findings);
```

### 2. Task Planning Agent

```typescript
interface Task {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependencies: string[];
  result?: any;
}

class TaskPlanningAgent {
  private tasks: Task[] = [];

  async planAndExecute(goal: string): Promise<Task[]> {
    // Step 1: Break down goal into tasks
    const plan = await this.createPlan(goal);
    
    // Step 2: Execute tasks in order (respecting dependencies)
    await this.executePlan(plan);

    return this.tasks;
  }

  private async createPlan(goal: string): Promise<Task[]> {
    const prompt = `Break down this goal into concrete tasks:\n\n"${goal}"\n\nOutput as JSON array: [{"description": "...", "dependencies": []}]`;

    const result = await TextGeneration.generate(prompt, {
      maxTokens: 300,
      temperature: 0.3,
    });

    try {
      const planData = JSON.parse(result.text);
      this.tasks = planData.map((task: any, i: number) => ({
        id: `task_${i}`,
        description: task.description,
        status: 'pending' as const,
        dependencies: task.dependencies || [],
      }));
      return this.tasks;
    } catch {
      throw new Error('Failed to parse plan');
    }
  }

  private async executePlan(tasks: Task[]) {
    for (const task of tasks) {
      // Check if dependencies are completed
      const depsCompleted = task.dependencies.every(depId => {
        const dep = this.tasks.find(t => t.id === depId);
        return dep?.status === 'completed';
      });

      if (!depsCompleted) {
        console.log(`Skipping ${task.id} - dependencies not met`);
        continue;
      }

      // Execute task
      task.status = 'in_progress';
      try {
        task.result = await this.executeTask(task);
        task.status = 'completed';
        console.log(`✓ Completed: ${task.description}`);
      } catch (err) {
        task.status = 'failed';
        console.error(`✗ Failed: ${task.description}`, err);
      }
    }
  }

  private async executeTask(task: Task): Promise<any> {
    // Use tool calling to execute the task
    const result = await ToolCalling.generateWithTools(
      `Execute this task: ${task.description}`,
      {
        autoExecute: true,
        maxToolCalls: 5,
        temperature: 0.3,
      }
    );

    return result.text;
  }

  getStatus(): string {
    const completed = this.tasks.filter(t => t.status === 'completed').length;
    const total = this.tasks.length;
    return `${completed}/${total} tasks completed`;
  }
}

// Usage
const agent = new TaskPlanningAgent();
await agent.planAndExecute('Plan a birthday party for 20 people');
console.log(agent.getStatus());
```

---

## Accessibility Features

### 1. Screen Reader for Images

```typescript
class VisualAssistant {
  private isDescribing = false;

  async describeScene(continuous = false) {
    const cam = new VideoCapture({ facingMode: 'environment' });
    await cam.start();

    this.isDescribing = true;

    while (this.isDescribing) {
      const frame = cam.captureFrame(256);
      if (!frame) continue;

      const bridge = VLMWorkerBridge.shared;
      const result = await bridge.process(
        frame.rgbPixels,
        frame.width,
        frame.height,
        'Describe what you see in detail, mentioning any text, objects, people, or important visual elements.',
        { maxTokens: 150, temperature: 0.6 }
      );

      // Speak the description
      await this.speak(result.text);

      if (!continuous) break;
      await new Promise(r => setTimeout(r, 5000)); // Every 5 seconds
    }

    cam.stop();
  }

  private async speak(text: string) {
    const ttsResult = await TTS.synthesize(text, { speed: 1.1 });
    const player = new AudioPlayback({ sampleRate: ttsResult.sampleRate });
    await player.play(ttsResult.audio, ttsResult.sampleRate);
    player.dispose();
  }

  stop() {
    this.isDescribing = false;
  }
}

// Usage with keyboard shortcuts
document.addEventListener('keydown', async (e) => {
  if (e.key === 'F1') {
    const assistant = new VisualAssistant();
    await assistant.describeScene(false); // Single description
  } else if (e.key === 'F2') {
    const assistant = new VisualAssistant();
    await assistant.describeScene(true); // Continuous
  }
});
```

### 2. Real-time Caption Generator

```typescript
class LiveCaptioner {
  private captions: HTMLDivElement;
  private mic: AudioCapture | null = null;

  constructor(captionElement: HTMLDivElement) {
    this.captions = captionElement;
  }

  async start() {
    this.mic = new AudioCapture({ sampleRate: 16000 });
    VAD.reset();

    let captionQueue: string[] = [];

    VAD.onSpeechActivity(async (activity) => {
      if (activity === SpeechActivity.Ended) {
        const segment = VAD.popSpeechSegment();
        if (segment && segment.samples.length > 1600) {
          const result = await STT.transcribe(segment.samples);
          captionQueue.push(result.text);
          this.displayCaption(result.text);

          // Keep only last 5 captions
          if (captionQueue.length > 5) {
            captionQueue.shift();
          }
        }
      }
    });

    await this.mic.start(
      (chunk) => VAD.processSamples(chunk),
      (level) => {} // Ignore level
    );
  }

  private displayCaption(text: string) {
    const captionDiv = document.createElement('div');
    captionDiv.className = 'caption-line';
    captionDiv.textContent = text;
    captionDiv.style.opacity = '1';
    captionDiv.style.transition = 'opacity 0.5s';

    this.captions.appendChild(captionDiv);

    // Fade out after 5 seconds
    setTimeout(() => {
      captionDiv.style.opacity = '0';
      setTimeout(() => captionDiv.remove(), 500);
    }, 5000);
  }

  stop() {
    this.mic?.stop();
  }
}

// Usage
const captionContainer = document.getElementById('captions') as HTMLDivElement;
const captioner = new LiveCaptioner(captionContainer);
await captioner.start();
```

---

## Creative Tools

### 1. Story Generator with Choices

```typescript
interface StoryNode {
  text: string;
  choices: string[];
}

class InteractiveStory {
  private history: string[] = [];

  async start(premise: string): Promise<StoryNode> {
    const prompt = `Start an interactive story with this premise:\n\n"${premise}"\n\nWrite 2-3 paragraphs, then provide 3 choices for what happens next. Format:\n\nSTORY:\n[story text]\n\nCHOICES:\n1. [choice 1]\n2. [choice 2]\n3. [choice 3]`;

    const result = await TextGeneration.generate(prompt, {
      maxTokens: 300,
      temperature: 0.9, // High creativity
    });

    return this.parseStoryNode(result.text);
  }

  async continue(choice: string): Promise<StoryNode> {
    this.history.push(choice);

    const context = this.history.slice(-3).join('\n');
    const prompt = `Continue the story based on this choice:\n\n"${choice}"\n\nPrevious context:\n${context}\n\nWrite what happens next (2-3 paragraphs), then provide 3 new choices.`;

    const result = await TextGeneration.generate(prompt, {
      maxTokens: 300,
      temperature: 0.9,
    });

    return this.parseStoryNode(result.text);
  }

  private parseStoryNode(text: string): StoryNode {
    const parts = text.split(/CHOICES?:/i);
    const story = parts[0].replace(/STORY:/i, '').trim();
    const choicesText = parts[1] || '';
    
    const choices = choicesText
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(choice => choice.length > 0);

    return { text: story, choices };
  }

  reset() {
    this.history = [];
  }
}

// Usage
const story = new InteractiveStory();

const node1 = await story.start('A detective finds a mysterious letter');
console.log(node1.text);
console.log('Choices:', node1.choices);

const node2 = await story.continue(node1.choices[0]);
console.log(node2.text);
```

### 2. Character Chat Simulator

```typescript
interface Character {
  name: string;
  personality: string;
  background: string;
  voice: string;
}

class CharacterSimulator {
  private character: Character;
  private conversation: string[] = [];

  constructor(character: Character) {
    this.character = character;
  }

  async chat(message: string): Promise<{ text: string; audio?: Float32Array }> {
    this.conversation.push(`You: ${message}`);

    const systemPrompt = `You are ${this.character.name}.
Personality: ${this.character.personality}
Background: ${this.character.background}

Stay in character. Respond naturally as ${this.character.name} would.`;

    const context = this.conversation.slice(-6).join('\n');
    const prompt = `${context}\n${this.character.name}:`;

    const { stream, result } = await TextGeneration.generateStream(prompt, {
      systemPrompt,
      maxTokens: 150,
      temperature: 0.8,
    });

    let response = '';
    for await (const token of stream) {
      response += token;
    }

    this.conversation.push(`${this.character.name}: ${response}`);

    // Generate voice if character has a voice
    let audio: Float32Array | undefined;
    if (this.character.voice) {
      const ttsResult = await TTS.synthesize(response);
      audio = ttsResult.audio;
    }

    return { text: response, audio };
  }

  reset() {
    this.conversation = [];
  }
}

// Usage
const sherlock: Character = {
  name: 'Sherlock Holmes',
  personality: 'Brilliant, observant, logical, sometimes arrogant',
  background: 'World-famous detective living in Victorian London',
  voice: 'british-male',
};

const simulator = new CharacterSimulator(sherlock);

const response = await simulator.chat('What do you think of this case?');
console.log(response.text);

if (response.audio) {
  const player = new AudioPlayback({ sampleRate: 22050 });
  await player.play(response.audio, 22050);
  player.dispose();
}
```

---

## Best Practices Summary

1. **Debounce user input** - Don't trigger generation on every keystroke
2. **Use appropriate temperatures** - Lower (0.1-0.4) for facts, higher (0.7-1.0) for creativity
3. **Stream when possible** - Better UX than waiting for full response
4. **Handle errors gracefully** - Network, memory, and model errors can occur
5. **Provide cancel buttons** - Let users stop long-running operations
6. **Cache results** - Don't regenerate the same content repeatedly
7. **Optimize prompts** - Clear, specific prompts yield better results
8. **Monitor performance** - Track tokens/sec and adjust model size accordingly
9. **Test on target devices** - Performance varies significantly by hardware
10. **Respect privacy** - All processing happens on-device, maintain that guarantee

---

For more examples, see the [Features Guide](./FEATURES_GUIDE.md) and [Quick Reference](./QUICK_REFERENCE.md).
