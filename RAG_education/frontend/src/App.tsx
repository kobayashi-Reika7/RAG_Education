import { useState, useEffect, Fragment } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import AskTab from './components/AskTab';
import QuizTab from './components/QuizTab';
import PracticeTab from './components/PracticeTab';
import DashboardTab from './components/DashboardTab';
import DataTab from './components/DataTab';

type Tab = 'ask' | 'practice' | 'quiz' | 'dashboard' | 'data';

interface NavItem {
  id: Tab;
  label: string;
  icon: string;
  desc: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Input',
    items: [
      { id: 'ask', label: '質問する', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z', desc: 'マニュアルについて聞く' },
      { id: 'practice', label: '問題演習', icon: 'M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z', desc: '4択ドリルで知識を定着' },
    ],
  },
  {
    title: 'Output',
    items: [
      { id: 'quiz', label: 'クイズ', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', desc: '○×問題で理解度を確認' },
    ],
  },
  {
    title: 'Record',
    items: [
      { id: 'dashboard', label: '学習記録', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z', desc: '成績・進捗を確認' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { id: 'data', label: 'データ管理', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z', desc: 'ファイルアップロード・管理' },
    ],
  },
];

const ALL_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);

function MainApp() {
  const { user, loading, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('ask');
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [s3FileCount, setS3FileCount] = useState<number>(0);
  const apiBase = import.meta.env.VITE_API_BASE || '';

  useEffect(() => {
    fetch(`${apiBase}/api/health`)
      .then((r) => r.json())
      .then((data) => { setHealthy(true); setS3FileCount(data.s3_files || 0); })
      .catch(() => setHealthy(false));
  }, [apiBase]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" />
          <p className="text-sm text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const current = ALL_ITEMS.find((n) => n.id === tab);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[260px] shrink-0 glass border-r border-white/40 flex flex-col">
        {/* Logo */}
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center shadow-lg shadow-primary-500/25">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-gray-900 tracking-tight">RAG Education</h1>
              <p className="text-[11px] text-gray-400 font-medium">AI Learning Platform</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3">
          {NAV_SECTIONS.map((section, si) => (
            <Fragment key={section.title}>
              <p className={`px-3 pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider ${si === 0 ? 'pt-4' : 'pt-5'}`}>
                {section.title}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 group btn-press ${
                      tab === item.id
                        ? 'bg-primary-500/10 text-primary-700 shadow-sm shadow-primary-500/5'
                        : 'text-gray-500 hover:bg-gray-100/60 hover:text-gray-700'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                        tab === item.id
                          ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30'
                          : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200 group-hover:text-gray-500'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className={`text-[13px] font-semibold truncate ${tab === item.id ? 'text-primary-700' : ''}`}>
                        {item.label}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate">{item.desc}</p>
                    </div>
                    {tab === item.id && (
                      <div className="ml-auto w-1.5 h-5 rounded-full bg-primary-500" />
                    )}
                  </button>
                ))}
              </div>
            </Fragment>
          ))}
        </nav>

        {/* User + Status */}
        <div className="px-4 py-3 border-t border-gray-100/80 space-y-3">
          {/* User info */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-purple-500 flex items-center justify-center text-white text-[12px] font-bold shrink-0">
              {(user.displayName || user.email || '?')[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-gray-700 truncate">
                {user.displayName || 'ユーザー'}
              </p>
              <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
            </div>
            <button
              onClick={signOut}
              title="ログアウト"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </button>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                healthy === null ? 'bg-gray-300' : healthy ? 'bg-success-500 pulse-glow' : 'bg-danger-500'
              }`}
            />
            <span className="text-[10px] text-gray-400">
              {healthy === null ? 'API 接続中...' : healthy ? 'API 接続済み' : 'API 未接続'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="glass border-b border-white/40 px-6 py-3.5 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-[15px] font-bold text-gray-900">{current?.label}</h2>
            <p className="text-[12px] text-gray-400 mt-0.5">{current?.desc}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 text-primary-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <span className="text-[11px] font-semibold">{s3FileCount} files (S3)</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-hidden">
          {tab === 'ask' && <AskTab />}
          {tab === 'practice' && <PracticeTab />}
          {tab === 'quiz' && <QuizTab />}
          {tab === 'dashboard' && <DashboardTab />}
          {tab === 'data' && <DataTab onFileCountChange={setS3FileCount} />}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;
