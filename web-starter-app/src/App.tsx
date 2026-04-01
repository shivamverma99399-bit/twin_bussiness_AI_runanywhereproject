import { ChatTab } from './components/ChatTab';

export function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div>
          <p className="eyebrow">AI Pricing Sandbox</p>
          <h1>Business Twin</h1>
        </div>
        <span className="badge">Full Stack</span>
      </header>

      <main className="tab-content">
        <ChatTab />
      </main>
    </div>
  );
}
