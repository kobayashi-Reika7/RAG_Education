import { useState, useEffect } from 'react';
import AskTab from './components/AskTab';
import QuizTab from './components/QuizTab';

type Tab = 'ask' | 'quiz';

function App() {
  const [tab, setTab] = useState<Tab>('ask');
  const [healthy, setHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(() => setHealthy(true))
      .catch(() => setHealthy(false));
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gray-900">RAG Education</h1>
          <span className="text-xs text-gray-400">新人教育クイズアプリ</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              healthy === null ? 'bg-gray-300' : healthy ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-xs text-gray-400">
            {healthy === null ? '接続中...' : healthy ? 'API接続済' : 'API未接続'}
          </span>
        </div>
      </header>

      {/* Tab navigation */}
      <div className="bg-white border-b border-gray-200 px-6 shrink-0">
        <nav className="flex gap-6">
          <button
            onClick={() => setTab('ask')}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'ask'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            質問する
          </button>
          <button
            onClick={() => setTab('quiz')}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'quiz'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            クイズ
          </button>
        </nav>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {tab === 'ask' && <AskTab />}
        {tab === 'quiz' && <QuizTab />}
      </main>
    </div>
  );
}

export default App;
