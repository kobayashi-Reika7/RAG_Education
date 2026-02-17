import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

type Mode = 'login' | 'signup' | 'confirm';

export default function LoginPage() {
  const { signIn, signUp, confirmSignUp } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else if (mode === 'signup') {
        if (!displayName.trim()) {
          setError('表示名を入力してください');
          setLoading(false);
          return;
        }
        const result = await signUp(email, password, displayName.trim());
        if (result === 'CONFIRM_SIGN_UP') {
          setMode('confirm');
        }
      } else if (mode === 'confirm') {
        await confirmSignUp(email, confirmCode);
        await signIn(email, password);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'エラーが発生しました';
      if (msg.includes('NotAuthorizedException') || msg.includes('Incorrect username or password')) {
        setError('メールアドレスまたはパスワードが正しくありません');
      } else if (msg.includes('UsernameExistsException')) {
        setError('このメールアドレスは既に登録されています');
      } else if (msg.includes('InvalidPasswordException') || msg.includes('Password did not conform')) {
        setError('パスワードは8文字以上で、数字と英小文字を含めてください');
      } else if (msg.includes('InvalidParameterException')) {
        setError('入力内容が正しくありません');
      } else if (msg.includes('CodeMismatchException')) {
        setError('確認コードが正しくありません');
      } else if (msg.includes('ExpiredCodeException')) {
        setError('確認コードの有効期限が切れています。再度登録してください');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-purple-600 mb-5 shadow-xl shadow-primary-500/25">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">RAG Education</h1>
          <p className="text-sm text-gray-400 mt-1">AI Learning Platform</p>
        </div>

        {/* Card */}
        <div className="glass rounded-3xl p-8 shadow-xl shadow-black/5">
          {/* Tab */}
          {mode !== 'confirm' && (
            <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
              <button
                onClick={() => { setMode('login'); setError(''); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  mode === 'login'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                ログイン
              </button>
              <button
                onClick={() => { setMode('signup'); setError(''); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  mode === 'signup'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                新規登録
              </button>
            </div>
          )}

          {/* Confirm header */}
          {mode === 'confirm' && (
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-50 mb-3">
                <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-900">メール確認</h2>
              <p className="text-sm text-gray-500 mt-1">
                <span className="font-medium text-gray-700">{email}</span> に送信された確認コードを入力してください
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-[13px] scale-in">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-[12px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                  表示名
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="山田 太郎"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-[14px] text-gray-700 bg-white focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all duration-200"
                />
              </div>
            )}

            {mode !== 'confirm' && (
              <>
                <div>
                  <label className="block text-[12px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                    メールアドレス
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-[14px] text-gray-700 bg-white focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                    パスワード
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="8文字以上（英小文字+数字）"
                    required
                    minLength={8}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-[14px] text-gray-700 bg-white focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all duration-200"
                  />
                </div>
              </>
            )}

            {mode === 'confirm' && (
              <div>
                <label className="block text-[12px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                  確認コード（6桁）
                </label>
                <input
                  type="text"
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                  placeholder="123456"
                  required
                  maxLength={6}
                  pattern="[0-9]{6}"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-[14px] text-gray-700 bg-white focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all duration-200 text-center text-2xl tracking-[0.5em] font-mono"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white text-sm font-semibold shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 btn-press"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  処理中...
                </span>
              ) : mode === 'login' ? (
                'ログイン'
              ) : mode === 'signup' ? (
                'アカウント作成'
              ) : (
                '確認して登録'
              )}
            </button>
          </form>

          {/* Back button for confirm mode */}
          {mode === 'confirm' && (
            <button
              onClick={() => { setMode('signup'); setError(''); setConfirmCode(''); }}
              className="w-full mt-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all duration-200"
            >
              戻る
            </button>
          )}
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-6">
          RAG Education - AI 新人教育プラットフォーム
        </p>
      </div>
    </div>
  );
}
