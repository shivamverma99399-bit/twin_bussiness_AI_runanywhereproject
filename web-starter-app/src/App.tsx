import { ChatTab } from './components/ChatTab';

export function App() {
  return (
    <div className="app">
      <div className="layout">
  
  <div className="left">
    <header className="app-header">
      <p className="eyebrow">AI Pricing Sandbox</p>
      <h2>Business Twin</h2>
    </header>
  </div>

  <div className="right">
    <ChatTab />
  </div>

</div>
    </div>
  );
}
