import { useEffect, useState } from 'react';
import { api, type StatsResponse, type HistoryItem, type DailyActivity } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

const DIFF_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  beginner:     { label: '初級', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  intermediate: { label: '中級', color: 'text-amber-600',   bg: 'bg-amber-50' },
  advanced:     { label: '上級', color: 'text-rose-600',     bg: 'bg-rose-50' },
};

export default function DashboardTab() {
  const { user } = useAuth();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedHistory, setSelectedHistory] = useState<HistoryItem | null>(null);

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

  useEffect(() => { loadStats(); }, []);

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
          <button onClick={loadStats} className="px-5 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors btn-press">
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  const totalSolved = (stats?.total_quizzes ?? 0) + (stats?.total_practices ?? 0);
  const totalCorrect = stats?.total_correct ?? 0;
  const overallAccuracy = totalSolved > 0 ? Math.round((totalCorrect / totalSolved) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto px-6 py-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between slide-up">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {user?.displayName || 'ユーザー'}さんの学習記録
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">成績と進捗を確認しましょう</p>
          </div>
          <button
            onClick={loadStats}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 transition-colors btn-press"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            更新
          </button>
        </div>

        {/* Main Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 slide-up">
          <StatCard label="総回答数" value={totalSolved} unit="問" gradient="from-blue-500 to-indigo-600" />
          <StatCard label="正解数" value={totalCorrect} unit="問" gradient="from-emerald-500 to-teal-600" />
          <StatCard label="正答率" value={overallAccuracy} unit="%" gradient="from-violet-500 to-purple-600" />
          <StatCard label="連続学習" value={stats?.streak_days ?? 0} unit="日" gradient="from-orange-500 to-amber-600" />
        </div>

        {/* Two columns: Accuracy Ring + Difficulty Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 slide-up">
          {/* Accuracy Ring */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h3 className="text-[13px] font-bold text-gray-900 mb-4">カテゴリ別 正答率</h3>
            <div className="flex items-center justify-around">
              <AccuracyRing label="クイズ (○×)" accuracy={stats?.quiz_accuracy ?? 0} count={stats?.total_quizzes ?? 0} color="#8b5cf6" />
              <AccuracyRing label="問題演習 (4択)" accuracy={stats?.practice_accuracy ?? 0} count={stats?.total_practices ?? 0} color="#3b82f6" />
            </div>
          </div>

          {/* Difficulty Breakdown */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h3 className="text-[13px] font-bold text-gray-900 mb-4">難易度別 成績</h3>
            <div className="space-y-3">
              {Object.entries(DIFF_LABELS).map(([key, { label, color, bg }]) => {
                const d = stats?.difficulty_stats?.[key];
                const total = d?.total ?? 0;
                const accuracy = d?.accuracy ?? 0;
                const pct = Math.round(accuracy * 100);
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${bg} ${color}`}>{label}</span>
                        <span className="text-[11px] text-gray-400">{total} 問</span>
                      </div>
                      <span className={`text-[13px] font-bold ${total > 0 ? color : 'text-gray-300'}`}>{total > 0 ? `${pct}%` : '—'}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${key === 'beginner' ? 'bg-emerald-400' : key === 'intermediate' ? 'bg-amber-400' : 'bg-rose-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Activity Chart (7 days) */}
        {stats?.daily_activity && stats.daily_activity.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm slide-up">
            <h3 className="text-[13px] font-bold text-gray-900 mb-4">直近7日間のアクティビティ</h3>
            <ActivityChart data={stats.daily_activity.slice(-7)} />
          </div>
        )}

        {/* Recent History */}
        <div className="slide-up">
          <h3 className="text-[13px] font-bold text-gray-900 mb-3">最近の学習履歴</h3>
          {(!stats?.recent_history || stats.recent_history.length === 0) ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <p className="text-sm text-gray-500 font-medium">まだ学習記録がありません</p>
              <p className="text-xs text-gray-400 mt-1">クイズや問題演習に挑戦してみましょう</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.recent_history.map((item) => (
                <HistoryRow key={item.id} item={item} onClick={() => setSelectedHistory(item)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedHistory && (
        <HistoryDetailModal
          item={selectedHistory}
          onClose={() => setSelectedHistory(null)}
        />
      )}
    </div>
  );
}


/* ========== Sub Components ========== */

function StatCard({ label, value, unit, gradient }: { label: string; value: number; unit: string; gradient: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm card-hover">
      <p className="text-2xl font-black text-gray-900">
        {value}<span className="text-sm font-semibold text-gray-400 ml-0.5">{unit}</span>
      </p>
      <p className="text-[11px] text-gray-400 font-medium mt-0.5">{label}</p>
    </div>
  );
}


function AccuracyRing({ label, accuracy, count, color }: { label: string; accuracy: number; count: number; color: string }) {
  const pct = Math.round(accuracy * 100);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (accuracy * circumference);

  return (
    <div className="text-center">
      <div className="relative w-24 h-24 mx-auto mb-2">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} stroke="#f3f4f6" strokeWidth="8" fill="none" />
          <circle
            cx="50" cy="50" r={radius}
            stroke={color}
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-black text-gray-900">{count > 0 ? `${pct}%` : '—'}</span>
        </div>
      </div>
      <p className="text-[11px] font-semibold text-gray-500">{label}</p>
      <p className="text-[10px] text-gray-400">{count} 問</p>
    </div>
  );
}


function ActivityChart({ data }: { data: DailyActivity[] }) {
  const maxTotal = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="flex items-end gap-1.5 h-28">
      {data.map((day) => {
        const h = day.total > 0 ? Math.max((day.total / maxTotal) * 100, 8) : 4;
        const correctH = day.total > 0 ? (day.correct / day.total) * h : 0;
        const wrongH = h - correctH;
        const dateLabel = day.date.slice(5);

        return (
          <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group" title={`${day.date}: ${day.correct}/${day.total} 正解`}>
            <div className="w-full flex flex-col items-center justify-end" style={{ height: '80px' }}>
              {day.total > 0 ? (
                <div className="w-full flex flex-col rounded-t-md overflow-hidden" style={{ height: `${h}%` }}>
                  {wrongH > 0 && <div className="bg-rose-300 opacity-60" style={{ flex: wrongH }} />}
                  {correctH > 0 && <div className="bg-emerald-400" style={{ flex: correctH }} />}
                </div>
              ) : (
                <div className="w-full bg-gray-100 rounded-t-md" style={{ height: '4px' }} />
              )}
            </div>
            <span className="text-[9px] text-gray-400 group-hover:text-gray-600 transition-colors">{dateLabel}</span>
          </div>
        );
      })}
    </div>
  );
}


function HistoryRow({ item, onClick }: { item: HistoryItem; onClick: () => void }) {
  const isQuiz = item.type === 'quiz';
  const diff = DIFF_LABELS[item.difficulty ?? ''] ?? DIFF_LABELS.beginner;

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    } catch { return ''; }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Result icon */}
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.is_correct ? 'bg-emerald-100' : 'bg-rose-100'}`}>
        {item.is_correct ? (
          <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-gray-700 font-medium truncate">{item.question || '(問題)'}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${isQuiz ? 'bg-violet-50 text-violet-600' : 'bg-blue-50 text-blue-600'}`}>
            {isQuiz ? '○× クイズ' : '4択 演習'}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${diff.bg} ${diff.color}`}>
            {diff.label}
          </span>
        </div>
      </div>

      {/* Result + time */}
      <div className="text-right shrink-0">
        <span className={`text-[13px] font-bold ${item.is_correct ? 'text-emerald-500' : 'text-rose-500'}`}>
          {item.is_correct ? '正解' : '不正解'}
        </span>
        <p className="text-[10px] text-gray-400 mt-0.5">{formatTime(item.timestamp)}</p>
      </div>
    </button>
  );
}

function HistoryDetailModal({ item, onClose }: { item: HistoryItem; onClose: () => void }) {
  const isQuiz = item.type === 'quiz';
  const diff = DIFF_LABELS[item.difficulty ?? ''] ?? DIFF_LABELS.beginner;
  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    } catch {
      return ts;
    }
  };

  const yourAnswer = isQuiz ? (item.user_answer || '—') : (item.selected || '—');
  const correctAnswer = isQuiz ? (item.expected_answer || '—') : (item.correct || '—');
  const choices = item.choices || {};
  const hasChoices = !isQuiz && ['A', 'B', 'C', 'D'].some((k) => Boolean((choices as Record<string, string | undefined>)[k]));
  const explanation = item.explanation || item.feedback || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white border border-gray-100 shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${isQuiz ? 'bg-violet-50 text-violet-600' : 'bg-blue-50 text-blue-600'}`}>
              {isQuiz ? '○× クイズ' : '4択 演習'}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${diff.bg} ${diff.color}`}>
              {diff.label}
            </span>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <p className="text-[11px] font-semibold text-gray-500 mb-1">問題</p>
            <p className="text-[14px] text-gray-800 leading-relaxed">{item.question || '(問題文なし)'}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
              <p className="text-[11px] text-gray-500">あなたの回答</p>
              <p className="text-[14px] font-bold text-gray-800 mt-1">{yourAnswer}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
              <p className="text-[11px] text-gray-500">正解</p>
              <p className="text-[14px] font-bold text-gray-800 mt-1">{correctAnswer}</p>
            </div>
          </div>

          {!isQuiz && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
              <p className="text-[11px] text-gray-500 mb-2">選択肢</p>
              {hasChoices ? (
                <div className="space-y-1.5">
                  {(['A', 'B', 'C', 'D'] as const).map((key) => {
                    const text = (choices as Record<string, string | undefined>)[key];
                    if (!text) return null;
                    const isSelected = yourAnswer === key;
                    const isCorrect = correctAnswer === key;
                    return (
                      <div key={key} className="flex items-start gap-2 text-[13px]">
                        <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 font-bold ${
                          isCorrect ? 'bg-emerald-100 text-emerald-700' : isSelected ? 'bg-rose-100 text-rose-700' : 'bg-white text-gray-600'
                        }`}>
                          {key}
                        </span>
                        <p className="text-gray-700 leading-relaxed">{text}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[12px] text-gray-400">この履歴には選択肢が保存されていません（改修前のデータ）。</p>
              )}
            </div>
          )}

          <div className="rounded-xl border border-primary-100 bg-primary-50 px-3 py-3">
            <p className="text-[11px] font-semibold text-primary-600 mb-1">解説</p>
            {explanation ? (
              <p className="text-[13px] text-primary-900 leading-relaxed">{explanation}</p>
            ) : (
              <p className="text-[12px] text-primary-400">この履歴には解説が保存されていません（改修前のデータ）。</p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2">
            <span className="text-[12px] text-gray-500">結果</span>
            <span className={`text-[13px] font-bold ${item.is_correct ? 'text-emerald-600' : 'text-rose-600'}`}>
              {item.is_correct ? '正解' : '不正解'}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2">
            <span className="text-[12px] text-gray-500">回答日時</span>
            <span className="text-[12px] font-medium text-gray-700">{formatTime(item.timestamp)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
