import { useState } from 'react';
import { api, type PracticeResponse } from '../lib/api';

type Phase = 'setup' | 'loading' | 'answering' | 'result';
type Choice = 'A' | 'B' | 'C' | 'D';
type Difficulty = 'beginner' | 'intermediate' | 'advanced';

const CHOICE_STYLES: Record<string, { base: string; ring: string }> = {
  A: { base: 'from-blue-500 to-blue-600', ring: 'ring-blue-300' },
  B: { base: 'from-violet-500 to-purple-600', ring: 'ring-violet-300' },
  C: { base: 'from-teal-500 to-emerald-600', ring: 'ring-teal-300' },
  D: { base: 'from-orange-500 to-amber-600', ring: 'ring-orange-300' },
};

const DIFFICULTY_CONFIG: Record<Difficulty, {
  label: string;
  desc: string;
  gradient: string;
  bgLight: string;
  icon: string;
}> = {
  beginner: {
    label: '初級',
    desc: '用語を選ぶだけ',
    gradient: 'from-emerald-400 to-teal-500',
    bgLight: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    icon: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25',
  },
  intermediate: {
    label: '中級',
    desc: '内容を理解して選ぶ',
    gradient: 'from-amber-400 to-orange-500',
    bgLight: 'bg-amber-50 border-amber-200 text-amber-700',
    icon: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z',
  },
  advanced: {
    label: '上級',
    desc: '複数知識を組み合わせる',
    gradient: 'from-rose-400 to-pink-600',
    bgLight: 'bg-rose-50 border-rose-200 text-rose-700',
    icon: 'M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z',
  },
};

export default function PracticeTab() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner');
  const [problem, setProblem] = useState<PracticeResponse | null>(null);
  const [selected, setSelected] = useState<Choice | null>(null);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({ total: 0, correct: 0 });
  const [nextProblem, setNextProblem] = useState<PracticeResponse | null>(null);
  const [prefetching, setPrefetching] = useState(false);

  const prefetch = async () => {
    if (prefetching) return;
    setPrefetching(true);
    try {
      const res = await api.generatePractice(difficulty);
      setNextProblem(res);
    } catch {
      setNextProblem(null);
    } finally {
      setPrefetching(false);
    }
  };

  const generate = async () => {
    setPhase('loading');
    setError('');
    setSelected(null);

    if (nextProblem) {
      setProblem(nextProblem);
      setNextProblem(null);
      setPhase('answering');
      return;
    }

    try {
      const res = await api.generatePractice(difficulty);
      setProblem(res);
      setPhase('answering');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '問題の生成に失敗しました');
      setPhase('setup');
    }
  };

  const handleSelect = (choice: Choice) => {
    if (phase !== 'answering' || selected || !problem) return;
    setSelected(choice);
    setPhase('result');
    const isCorrect = problem.correct === choice;
    setStats((prev) => ({
      total: prev.total + 1,
      correct: prev.correct + (isCorrect ? 1 : 0),
    }));

    api.savePracticeResult({
      practice_id: problem.practice_id,
      question: problem.question,
      selected: choice,
      correct: problem.correct,
      difficulty,
    }).catch(() => {});

    prefetch();
  };

  const next = () => {
    generate();
  };

  const reset = () => {
    setPhase('setup');
    setProblem(null);
    setSelected(null);
    setStats({ total: 0, correct: 0 });
    setError('');
    setNextProblem(null);
  };

  const isCorrect = selected === problem?.correct;
  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  const config = DIFFICULTY_CONFIG[difficulty];

  return (
    <div className="h-full overflow-y-auto px-6 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Error */}
        {error && (
          <div className="mb-6 flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-5 py-4 text-sm float-in">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* ===== SETUP ===== */}
        {phase === 'setup' && (
          <div className="slide-up">
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-100 to-emerald-100 mb-6">
                <svg className="w-10 h-10 text-teal-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">問題演習</h2>
              <p className="text-sm text-gray-400 max-w-sm mx-auto">
                4択形式で繰り返し学習できます。<br />難易度を選んで始めましょう。
              </p>
            </div>

            {/* Difficulty cards */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((d) => {
                const c = DIFFICULTY_CONFIG[d];
                const sel = difficulty === d;
                return (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`relative p-5 rounded-2xl border-2 text-left transition-all duration-200 card-hover btn-press ${
                      sel
                        ? 'border-teal-400 bg-white shadow-lg shadow-teal-500/10'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    {sel && (
                      <div className="absolute top-3 right-3">
                        <div className="w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        </div>
                      </div>
                    )}
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.gradient} flex items-center justify-center mb-3 shadow-md`}>
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d={c.icon} />
                      </svg>
                    </div>
                    <p className="text-sm font-bold text-gray-900">{c.label}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{c.desc}</p>
                  </button>
                );
              })}
            </div>

            {/* Stats (if any) */}
            {stats.total > 0 && (
              <div className="flex justify-center mb-6">
                <div className="inline-flex items-center gap-4 bg-white rounded-2xl border border-gray-200 px-5 py-3 shadow-sm scale-in">
                  <div className="text-center">
                    <p className="text-xl font-bold text-gray-900">{stats.total}</p>
                    <p className="text-[10px] text-gray-400 font-medium">問題数</p>
                  </div>
                  <div className="w-px h-8 bg-gray-200" />
                  <div className="text-center">
                    <p className="text-xl font-bold text-emerald-500">{stats.correct}</p>
                    <p className="text-[10px] text-gray-400 font-medium">正解</p>
                  </div>
                  <div className="w-px h-8 bg-gray-200" />
                  <div className="text-center">
                    <p className="text-xl font-bold text-teal-500">{accuracy}%</p>
                    <p className="text-[10px] text-gray-400 font-medium">正答率</p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={generate}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-sm font-semibold shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/30 hover:from-teal-600 hover:to-emerald-600 transition-all duration-200 btn-press"
            >
              {stats.total > 0 ? '続きから始める' : '演習を始める'}
            </button>
          </div>
        )}

        {/* ===== LOADING ===== */}
        {phase === 'loading' && (
          <div className="text-center pt-24 slide-up">
            <div className="spinner mx-auto mb-6" style={{ borderTopColor: '#14b8a6' }} />
            <p className="text-sm font-medium text-gray-500">問題を作成中...</p>
            <p className="text-xs text-gray-400 mt-1">少々お待ちください</p>
          </div>
        )}

        {/* ===== ANSWERING / RESULT ===== */}
        {(phase === 'answering' || phase === 'result') && problem && (
          <div className="space-y-5 slide-up">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`text-[11px] px-3 py-1 rounded-full font-semibold border ${config.bgLight}`}>
                  {config.label}
                </span>
                <span className="text-[11px] px-3 py-1 rounded-full font-semibold border bg-teal-50 border-teal-200 text-teal-700">
                  4択
                </span>
                <span className="text-[11px] text-gray-400 font-mono">{problem.practice_id}</span>
              </div>
              {stats.total > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-gray-500">
                    {stats.correct}/{stats.total}
                  </span>
                  <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-teal-400 to-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${accuracy}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Question card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center mt-0.5">
                  <span className="text-white text-sm font-bold">Q</span>
                </div>
                <p className="text-[15px] text-gray-800 leading-[1.8] font-medium">{problem.question}</p>
              </div>
            </div>

            {/* Choices */}
            <div className="grid grid-cols-1 gap-3">
              {(['A', 'B', 'C', 'D'] as Choice[]).map((key) => {
                const text = problem.choices[key];
                if (!text) return null;
                const style = CHOICE_STYLES[key];
                const isThis = selected === key;
                const isAnswer = problem.correct === key;
                const showResult = phase === 'result';

                let stateClass = '';
                if (showResult && isAnswer) {
                  stateClass = 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200';
                } else if (showResult && isThis && !isAnswer) {
                  stateClass = 'border-rose-400 bg-rose-50 ring-2 ring-rose-200';
                } else if (showResult) {
                  stateClass = 'border-gray-200 bg-gray-50/50 opacity-60';
                } else {
                  stateClass = `border-gray-200 bg-white hover:border-gray-300 hover:shadow-md cursor-pointer`;
                }

                return (
                  <button
                    key={key}
                    onClick={() => handleSelect(key)}
                    disabled={phase === 'result'}
                    className={`flex items-center gap-4 px-5 py-4 rounded-2xl border-2 text-left transition-all duration-200 btn-press ${stateClass}`}
                  >
                    <div className={`shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br ${style.base} flex items-center justify-center shadow-sm`}>
                      <span className="text-white text-sm font-bold">{key}</span>
                    </div>
                    <span className={`text-[13.5px] leading-relaxed ${showResult && !isAnswer && !isThis ? 'text-gray-400' : 'text-gray-700'} ${showResult && isAnswer ? 'font-semibold text-emerald-800' : ''}`}>
                      {text}
                    </span>
                    {showResult && isAnswer && (
                      <div className="ml-auto shrink-0">
                        <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        </div>
                      </div>
                    )}
                    {showResult && isThis && !isAnswer && (
                      <div className="ml-auto shrink-0">
                        <div className="w-6 h-6 rounded-full bg-rose-500 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Result feedback */}
            {phase === 'result' && (
              <div className="space-y-4 scale-in">
                <div className={`flex items-center gap-3 rounded-2xl px-5 py-4 ${isCorrect ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isCorrect ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                    {isCorrect ? (
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {isCorrect ? '正解！' : '不正解'}
                    </p>
                    <p className={`text-[12px] ${isCorrect ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {isCorrect ? 'よくできました' : `正解は ${problem.correct} です`}
                    </p>
                  </div>
                </div>

                {problem.explanation && (
                  <div className="bg-gradient-to-br from-primary-50 to-purple-50 rounded-2xl border border-primary-100 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded-md bg-primary-100 flex items-center justify-center">
                        <svg className="w-3 h-3 text-primary-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                        </svg>
                      </div>
                      <span className="text-[11px] font-semibold text-primary-500 uppercase tracking-wider">解説</span>
                    </div>
                    <p className="text-[13px] text-primary-900 leading-[1.8]">{problem.explanation}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={next}
                    className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-sm font-semibold shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/30 transition-all duration-200 btn-press"
                  >
                    次の問題
                  </button>
                  <button
                    onClick={reset}
                    className="px-6 py-3.5 rounded-2xl text-sm font-medium text-gray-500 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 btn-press"
                  >
                    終了
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
