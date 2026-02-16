import { useState } from 'react';
import { api, type QuizResponse, type EvalResponse } from '../lib/api';

type Phase = 'setup' | 'loading' | 'question' | 'evaluating' | 'result';
type Difficulty = 'beginner' | 'intermediate' | 'advanced';

const DIFFICULTY_LABELS: Record<Difficulty, { label: string; color: string }> = {
  beginner: { label: '初級', color: 'bg-green-100 text-green-800' },
  intermediate: { label: '中級', color: 'bg-yellow-100 text-yellow-800' },
  advanced: { label: '上級', color: 'bg-red-100 text-red-800' },
};

export default function QuizTab() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner');
  const [quiz, setQuiz] = useState<QuizResponse | null>(null);
  const [answer, setAnswer] = useState('');
  const [evalResult, setEvalResult] = useState<EvalResponse | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setPhase('loading');
    setError('');
    setShowHint(false);
    setAnswer('');
    setEvalResult(null);
    try {
      const res = await api.generateQuiz(difficulty);
      setQuiz(res);
      setPhase('question');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'クイズ生成に失敗しました');
      setPhase('setup');
    }
  };

  const evaluate = async () => {
    if (!quiz || !answer.trim()) return;
    setPhase('evaluating');
    setError('');
    try {
      const res = await api.evaluateQuiz({
        quiz_id: quiz.quiz_id,
        question: quiz.question,
        expected_answer: quiz.expected_answer,
        user_answer: answer.trim(),
        difficulty,
      });
      setEvalResult(res);
      setPhase('result');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '判定に失敗しました');
      setPhase('question');
    }
  };

  const reset = () => {
    setPhase('setup');
    setQuiz(null);
    setAnswer('');
    setEvalResult(null);
    setShowHint(false);
    setError('');
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Phase: Setup */}
      {phase === 'setup' && (
        <div className="text-center">
          <p className="text-5xl mb-6">&#127891;</p>
          <h2 className="text-xl font-bold text-gray-900 mb-2">教育クイズ</h2>
          <p className="text-gray-500 mb-8">難易度を選んでクイズに挑戦しましょう</p>

          <div className="flex justify-center gap-3 mb-8">
            {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`px-5 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                  difficulty === d
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                {DIFFICULTY_LABELS[d].label}
              </button>
            ))}
          </div>

          <button
            onClick={generate}
            className="bg-blue-600 text-white px-8 py-3 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            出題する
          </button>
        </div>
      )}

      {/* Phase: Loading */}
      {(phase === 'loading' || phase === 'evaluating') && (
        <div className="text-center py-20">
          <div className="inline-block w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-500">
            {phase === 'loading' ? 'クイズを生成中...' : '回答を判定中...'}
          </p>
        </div>
      )}

      {/* Phase: Question */}
      {phase === 'question' && quiz && (
        <div>
          <div className="flex items-center gap-2 mb-6">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${DIFFICULTY_LABELS[difficulty].color}`}>
              {DIFFICULTY_LABELS[difficulty].label}
            </span>
            <span className="text-xs text-gray-400">{quiz.quiz_id}</span>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
            <p className="text-gray-900 leading-relaxed">{quiz.question}</p>
          </div>

          {quiz.hint && (
            <div className="mb-6">
              {showHint ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                  <span className="font-medium">ヒント:</span> {quiz.hint}
                </div>
              ) : (
                <button
                  onClick={() => setShowHint(true)}
                  className="text-sm text-amber-600 hover:text-amber-700 underline"
                >
                  ヒントを見る
                </button>
              )}
            </div>
          )}

          <textarea
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={4}
            placeholder="回答を入力してください..."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />

          <div className="flex gap-3 mt-4">
            <button
              onClick={evaluate}
              disabled={!answer.trim()}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              回答する
            </button>
            <button
              onClick={reset}
              className="px-5 py-3 rounded-xl text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              やめる
            </button>
          </div>
        </div>
      )}

      {/* Phase: Result */}
      {phase === 'result' && evalResult && quiz && (
        <div>
          <div
            className={`text-center py-8 rounded-2xl mb-6 ${
              evalResult.is_correct
                ? 'bg-green-50 border border-green-200'
                : evalResult.score >= 0.5
                ? 'bg-yellow-50 border border-yellow-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            <p className="text-4xl mb-3">
              {evalResult.is_correct ? '\u{2B50}' : evalResult.score >= 0.5 ? '\u{1F44D}' : '\u{1F4AA}'}
            </p>
            <p className="text-lg font-bold text-gray-900">{evalResult.feedback}</p>
            <p className="text-2xl font-bold mt-1 text-gray-700">
              {Math.round(evalResult.score * 100)}点
            </p>
          </div>

          <div className="space-y-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">問題</p>
              <p className="text-sm text-gray-900">{quiz.question}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">あなたの回答</p>
              <p className="text-sm text-gray-900">{answer}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">模範解答</p>
              <p className="text-sm text-gray-900">{quiz.expected_answer}</p>
            </div>
            {evalResult.explanation && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs text-blue-600 mb-1">解説</p>
                <p className="text-sm text-blue-900">{evalResult.explanation}</p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={generate}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              次の問題
            </button>
            <button
              onClick={reset}
              className="px-5 py-3 rounded-xl text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              終了
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
