import { useState } from 'react';
import { api, type QuizResponse } from '../lib/api';

const TOTAL_QUESTIONS = 5;

type Phase = 'setup' | 'loading' | 'question' | 'result' | 'summary';
type Difficulty = 'beginner' | 'intermediate' | 'advanced';
type OxAnswer = '○' | '×';

interface QuizRecord {
  quiz: QuizResponse;
  answer: OxAnswer;
  isCorrect: boolean;
}

const DIFFICULTY_CONFIG: Record<Difficulty, {
  label: string;
  desc: string;
  gradient: string;
  bgLight: string;
  icon: string;
}> = {
  beginner: {
    label: '初級',
    desc: 'すぐ判断できる簡単な命題',
    gradient: 'from-emerald-400 to-teal-500',
    bgLight: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    icon: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25',
  },
  intermediate: {
    label: '中級',
    desc: '内容を理解して判断する',
    gradient: 'from-amber-400 to-orange-500',
    bgLight: 'bg-amber-50 border-amber-200 text-amber-700',
    icon: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z',
  },
  advanced: {
    label: '上級',
    desc: '複数知識を組み合わせて判断',
    gradient: 'from-rose-400 to-pink-600',
    bgLight: 'bg-rose-50 border-rose-200 text-rose-700',
    icon: 'M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z',
  },
};

export default function QuizTab() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [quizzes, setQuizzes] = useState<QuizResponse[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<OxAnswer | null>(null);
  const [records, setRecords] = useState<QuizRecord[]>([]);
  const [error, setError] = useState('');

  const quiz = quizzes[currentIndex] ?? null;

  const startQuiz = async () => {
    setPhase('loading');
    setError('');
    setSelectedAnswer(null);
    setRecords([]);
    setCurrentIndex(0);
    setQuizzes([]);
    try {
      const batch = await api.generateQuizBatch(difficulty, TOTAL_QUESTIONS);
      setQuizzes(batch);
      setPhase('question');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'クイズ生成に失敗しました');
      setPhase('setup');
    }
  };

  const handleAnswer = (answer: OxAnswer) => {
    if (!quiz || selectedAnswer) return;
    setSelectedAnswer(answer);
    setPhase('result');

    api.saveQuizResult({
      quiz_id: quiz.quiz_id,
      question: quiz.question,
      expected_answer: quiz.expected_answer,
      user_answer: answer,
      is_correct: answer === quiz.expected_answer,
      difficulty,
    }).catch(() => {});
  };

  const isCorrect = selectedAnswer === quiz?.expected_answer;

  const nextQuestion = () => {
    if (!quiz || !selectedAnswer) return;
    const newRecords = [...records, { quiz, answer: selectedAnswer, isCorrect: selectedAnswer === quiz.expected_answer }];
    setRecords(newRecords);

    if (newRecords.length >= TOTAL_QUESTIONS) {
      setPhase('summary');
    } else {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setPhase('question');
    }
  };

  const reset = () => {
    setPhase('setup');
    setQuizzes([]);
    setSelectedAnswer(null);
    setRecords([]);
    setCurrentIndex(0);
    setError('');
  };

  const config = DIFFICULTY_CONFIG[difficulty];
  const correctCount = records.filter((r) => r.isCorrect).length;
  const accuracy = records.length > 0
    ? Math.round((correctCount / records.length) * 100)
    : 0;

  return (
    <div className="h-full overflow-y-auto px-6 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Error banner */}
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
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-100 to-purple-100 mb-6">
                <svg className="w-10 h-10 text-primary-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">○×クイズ</h2>
              <p className="text-sm text-gray-400 max-w-sm mx-auto">
                全{TOTAL_QUESTIONS}問の○×クイズに挑戦しましょう。<br />命題が正しければ○、誤りなら×を選んでください。
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8">
              {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((d) => {
                const c = DIFFICULTY_CONFIG[d];
                const selected = difficulty === d;
                return (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`relative p-5 rounded-2xl border-2 text-left transition-all duration-200 card-hover btn-press ${
                      selected
                        ? 'border-primary-400 bg-white shadow-lg shadow-primary-500/10'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    {selected && (
                      <div className="absolute top-3 right-3">
                        <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
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

            <button
              onClick={startQuiz}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 text-white text-sm font-semibold shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 hover:from-primary-600 hover:to-primary-700 transition-all duration-200 btn-press"
            >
              {TOTAL_QUESTIONS}問スタート
            </button>
          </div>
        )}

        {/* ===== LOADING ===== */}
        {phase === 'loading' && (
          <div className="text-center pt-24 slide-up">
            <div className="spinner mx-auto mb-6" />
            <p className="text-sm font-medium text-gray-500">
              第{currentIndex + 1}問を作成中...
            </p>
            <p className="text-xs text-gray-400 mt-1">少々お待ちください</p>
          </div>
        )}

        {/* ===== QUESTION / RESULT ===== */}
        {(phase === 'question' || phase === 'result') && quiz && (
          <div className="space-y-5 slide-up">
            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-gray-600">
                  第 {currentIndex + 1} 問 / {TOTAL_QUESTIONS}
                </span>
                <span className="text-[11px] text-gray-400">
                  {records.filter((r) => r.isCorrect).length + (phase === 'result' && isCorrect ? 1 : 0)} 正解
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-400 to-primary-500 rounded-full transition-all duration-500"
                  style={{ width: `${((phase === 'result' ? currentIndex + 1 : currentIndex) / TOTAL_QUESTIONS) * 100}%` }}
                />
              </div>
            </div>

            {/* Header badges */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-[11px] px-3 py-1 rounded-full font-semibold border ${config.bgLight}`}>
                  {config.label}
                </span>
                <span className="text-[11px] px-3 py-1 rounded-full font-semibold border bg-purple-50 border-purple-200 text-purple-600">
                  ○×
                </span>
              </div>
              <span className="text-[11px] text-gray-400 font-mono">{quiz.quiz_id}</span>
            </div>

            {/* Question card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-start gap-3">
                <div className={`shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br ${config.gradient} flex items-center justify-center mt-0.5`}>
                  <span className="text-white text-sm font-bold">Q</span>
                </div>
                <p className="text-[15px] text-gray-800 leading-[1.8] font-medium">{quiz.question}</p>
              </div>
            </div>

            {/* ○× Buttons */}
            {phase === 'question' && (
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleAnswer('○')}
                  className="group relative py-10 rounded-2xl border-2 border-gray-200 bg-white hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-200 btn-press"
                >
                  <div className="text-center">
                    <span className="text-6xl font-black text-emerald-500 group-hover:scale-110 transition-transform duration-200 inline-block">○</span>
                    <p className="text-sm font-semibold text-gray-500 mt-2">正しい</p>
                  </div>
                </button>
                <button
                  onClick={() => handleAnswer('×')}
                  className="group relative py-10 rounded-2xl border-2 border-gray-200 bg-white hover:border-rose-400 hover:shadow-lg hover:shadow-rose-500/10 transition-all duration-200 btn-press"
                >
                  <div className="text-center">
                    <span className="text-6xl font-black text-rose-500 group-hover:scale-110 transition-transform duration-200 inline-block">×</span>
                    <p className="text-sm font-semibold text-gray-500 mt-2">誤り</p>
                  </div>
                </button>
              </div>
            )}

            {/* Result feedback */}
            {phase === 'result' && selectedAnswer && (
              <div className="space-y-4 scale-in">
                {/* Your answer display */}
                <div className="grid grid-cols-2 gap-4">
                  <div
                    className={`py-6 rounded-2xl border-2 text-center transition-all ${
                      selectedAnswer === '○'
                        ? isCorrect
                          ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200'
                          : 'border-rose-400 bg-rose-50 ring-2 ring-rose-200'
                        : quiz.expected_answer === '○'
                        ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200'
                        : 'border-gray-200 bg-gray-50/50 opacity-40'
                    }`}
                  >
                    <span className="text-5xl font-black text-emerald-500">○</span>
                    {selectedAnswer === '○' && (
                      <div className="mt-2">
                        <span className={`text-[11px] font-bold ${isCorrect ? 'text-emerald-600' : 'text-rose-600'}`}>
                          あなたの回答
                        </span>
                      </div>
                    )}
                    {quiz.expected_answer === '○' && selectedAnswer !== '○' && (
                      <div className="mt-2">
                        <span className="text-[11px] font-bold text-emerald-600">正解</span>
                      </div>
                    )}
                  </div>
                  <div
                    className={`py-6 rounded-2xl border-2 text-center transition-all ${
                      selectedAnswer === '×'
                        ? isCorrect
                          ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200'
                          : 'border-rose-400 bg-rose-50 ring-2 ring-rose-200'
                        : quiz.expected_answer === '×'
                        ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200'
                        : 'border-gray-200 bg-gray-50/50 opacity-40'
                    }`}
                  >
                    <span className="text-5xl font-black text-rose-500">×</span>
                    {selectedAnswer === '×' && (
                      <div className="mt-2">
                        <span className={`text-[11px] font-bold ${isCorrect ? 'text-emerald-600' : 'text-rose-600'}`}>
                          あなたの回答
                        </span>
                      </div>
                    )}
                    {quiz.expected_answer === '×' && selectedAnswer !== '×' && (
                      <div className="mt-2">
                        <span className="text-[11px] font-bold text-emerald-600">正解</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Correct / Incorrect banner */}
                <div className={`flex items-center gap-3 rounded-2xl px-5 py-4 ${
                  isCorrect ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'
                }`}>
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
                      {isCorrect ? 'よくできました！' : `正解は「${quiz.expected_answer}」です`}
                    </p>
                  </div>
                </div>

                {/* Explanation */}
                {quiz.explanation && (
                  <div className="bg-gradient-to-br from-primary-50 to-purple-50 rounded-2xl border border-primary-100 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded-md bg-primary-100 flex items-center justify-center">
                        <svg className="w-3 h-3 text-primary-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                        </svg>
                      </div>
                      <span className="text-[11px] font-semibold text-primary-500 uppercase tracking-wider">解説</span>
                    </div>
                    <p className="text-[13px] text-primary-900 leading-[1.8]">{quiz.explanation}</p>
                  </div>
                )}

                {/* Next button */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={nextQuestion}
                    className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 text-white text-sm font-semibold shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 transition-all duration-200 btn-press"
                  >
                    {currentIndex + 1 < TOTAL_QUESTIONS ? `次の問題へ（${currentIndex + 2}/${TOTAL_QUESTIONS}）` : '結果を見る'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== SUMMARY ===== */}
        {phase === 'summary' && (
          <div className="space-y-6 slide-up">
            {/* Hero */}
            <div className={`text-center py-10 rounded-3xl border relative overflow-hidden ${
              accuracy >= 80
                ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200'
                : accuracy >= 50
                ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200'
                : 'bg-gradient-to-br from-rose-50 to-pink-50 border-rose-200'
            }`}>
              <p className="text-sm font-semibold text-gray-500 mb-2">正答率</p>
              <div className="count-up">
                <p className={`text-7xl font-black ${
                  accuracy >= 80 ? 'text-emerald-500' : accuracy >= 50 ? 'text-amber-500' : 'text-rose-500'
                }`}>
                  {accuracy}
                  <span className="text-3xl font-bold ml-1">%</span>
                </p>
              </div>
              <p className="text-lg font-bold text-gray-800 mt-3">
                {accuracy === 100 ? 'パーフェクト！' : accuracy >= 80 ? '素晴らしい！' : accuracy >= 50 ? 'もう少し！' : 'がんばろう！'}
              </p>
              <div className="flex justify-center gap-2 mt-4">
                <span className={`text-[11px] px-3 py-1 rounded-full font-semibold border ${config.bgLight}`}>
                  {config.label}
                </span>
                <span className="text-[11px] px-3 py-1 rounded-full font-semibold border bg-purple-50 border-purple-200 text-purple-600">
                  ○×
                </span>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm">
                <p className="text-2xl font-black text-emerald-500">{correctCount}</p>
                <p className="text-[11px] text-gray-400 mt-1">正解</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm">
                <p className="text-2xl font-black text-rose-500">{TOTAL_QUESTIONS - correctCount}</p>
                <p className="text-[11px] text-gray-400 mt-1">不正解</p>
              </div>
            </div>

            {/* Question results list */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-700 px-1">各問の結果</h3>
              {records.map((r, i) => (
                <div
                  key={r.quiz.quiz_id}
                  className={`rounded-2xl border p-4 ${
                    r.isCorrect
                      ? 'bg-emerald-50/50 border-emerald-100'
                      : 'bg-rose-50/50 border-rose-100'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold ${
                      r.isCorrect ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-gray-800 font-medium leading-relaxed line-clamp-2">{r.quiz.question}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`text-[12px] font-bold ${r.isCorrect ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {r.answer}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          →
                        </span>
                        <span className={`text-[12px] font-bold ${r.isCorrect ? 'text-emerald-600' : 'text-gray-500'}`}>
                          正解: {r.quiz.expected_answer}
                        </span>
                        <span className={`text-[11px] font-semibold ${r.isCorrect ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {r.isCorrect ? '○ 正解' : '× 不正解'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={startQuiz}
                className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 text-white text-sm font-semibold shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 transition-all duration-200 btn-press"
              >
                もう一度チャレンジ
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
    </div>
  );
}
