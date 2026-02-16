import { useEffect, useState } from 'react';
import { api, type StatsResponse, type HistoryItem } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';


export default function DashboardTab() {
  const { user } = useAuth();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getStats();
      setStats(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '統計の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" />
          <p className="text-sm text-gray-400">学習記録を読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadStats}
            className="px-5 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors btn-press"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  const totalSolved = (stats?.total_quizzes ?? 0) + (stats?.total_practices ?? 0);
  const avgPercent = Math.round((stats?.avg_score ?? 0) * 100);

  return (
    <div className="h-full overflow-y-auto px-6 py-8">
      <div className="max-w-3xl mx-auto">
        {/* Welcome */}
        <div className="mb-8 slide-up">
          <h2 className="text-xl font-bold text-gray-900">
            {user?.displayName || 'ユーザー'}さんの学習記録
          </h2>
          <p className="text-sm text-gray-400 mt-1">学習の進捗を確認しましょう</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 slide-up">
          <StatCard
            label="総回答数"
            value={totalSolved.toString()}
            unit="問"
            gradient="from-blue-500 to-indigo-600"
            icon="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z"
          />
          <StatCard
            label="クイズ"
            value={(stats?.total_quizzes ?? 0).toString()}
            unit="問"
            gradient="from-violet-500 to-purple-600"
            icon="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
          <StatCard
            label="平均スコア"
            value={avgPercent.toString()}
            unit="%"
            gradient="from-emerald-500 to-teal-600"
            icon="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
          />
          <StatCard
            label="連続学習"
            value={(stats?.streak_days ?? 0).toString()}
            unit="日"
            gradient="from-orange-500 to-amber-600"
            icon="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z"
          />
        </div>

        {/* Recent history */}
        <div className="slide-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-bold text-gray-900">最近の学習</h3>
            <button
              onClick={loadStats}
              className="text-[12px] text-primary-500 hover:text-primary-600 font-medium transition-colors"
            >
              更新
            </button>
          </div>

          {(!stats?.recent_history || stats.recent_history.length === 0) ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9.75m3 0h3m-3 0h-3m3 0H9.75m6-6H9.75" />
                </svg>
              </div>
              <p className="text-sm text-gray-500">まだ学習記録がありません</p>
              <p className="text-xs text-gray-400 mt-1">クイズや問題演習に挑戦してみましょう</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.recent_history.map((item) => (
                <HistoryRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


function StatCard({
  label,
  value,
  unit,
  gradient,
  icon,
}: {
  label: string;
  value: string;
  unit: string;
  gradient: string;
  icon: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm card-hover">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-3 shadow-md`}>
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <p className="text-2xl font-black text-gray-900">
        {value}
        <span className="text-sm font-semibold text-gray-400 ml-0.5">{unit}</span>
      </p>
      <p className="text-[11px] text-gray-400 font-medium mt-0.5">{label}</p>
    </div>
  );
}


function HistoryRow({ item }: { item: HistoryItem }) {
  const isQuiz = item.type === 'quiz';
  const scorePercent = Math.round(item.score * 100);

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const hours = d.getHours().toString().padStart(2, '0');
      const mins = d.getMinutes().toString().padStart(2, '0');
      return `${month}/${day} ${hours}:${mins}`;
    } catch {
      return '';
    }
  };

  return (
    <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm hover:shadow-md transition-shadow">
      {/* Icon */}
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          isQuiz
            ? 'bg-violet-100 text-violet-600'
            : 'bg-blue-100 text-blue-600'
        }`}
      >
        <span className="text-[10px] font-bold">{isQuiz ? 'Q' : 'P'}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-gray-700 font-medium truncate">{item.question || '(問題)'}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
            isQuiz
              ? 'bg-violet-50 text-violet-600'
              : 'bg-blue-50 text-blue-600'
          }`}>
            {isQuiz ? 'クイズ' : '演習'}
          </span>
          {item.difficulty && (
            <span className="text-[10px] text-gray-400">{item.difficulty}</span>
          )}
        </div>
      </div>

      {/* Result */}
      <div className="text-right shrink-0">
        <span
          className={`text-[13px] font-bold ${
            item.is_correct ? 'text-emerald-500' : 'text-rose-500'
          }`}
        >
          {item.is_correct ? (isQuiz ? `${scorePercent}%` : 'Correct') : (isQuiz ? `${scorePercent}%` : 'Wrong')}
        </span>
        <p className="text-[10px] text-gray-400 mt-0.5">{formatTime(item.timestamp)}</p>
      </div>
    </div>
  );
}
