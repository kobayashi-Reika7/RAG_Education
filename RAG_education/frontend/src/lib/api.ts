const BASE = '/api';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail?.error || err.detail || 'API Error');
  }
  return res.json();
}

export interface AskResponse {
  answer: string;
  sources: { chunk_id: string; section: string; content: string }[];
  response_time_ms: number;
}

export interface QuizResponse {
  quiz_id: string;
  difficulty: string;
  question: string;
  hint: string | null;
  source_chunk_ids: string[];
  expected_answer: string;
  response_time_ms: number;
}

export interface EvalResponse {
  quiz_id: string;
  is_correct: boolean;
  score: number;
  feedback: string;
  explanation: string;
  response_time_ms: number;
}

export const api = {
  ask: (question: string) => post<AskResponse>('/ask', { question }),

  generateQuiz: (difficulty: string) =>
    post<QuizResponse>('/quiz/generate', { difficulty }),

  evaluateQuiz: (params: {
    quiz_id: string;
    question: string;
    expected_answer: string;
    user_answer: string;
    difficulty: string;
  }) => post<EvalResponse>('/quiz/evaluate', params),

  health: () => fetch(`${BASE}/health`).then((r) => r.json()),
};
