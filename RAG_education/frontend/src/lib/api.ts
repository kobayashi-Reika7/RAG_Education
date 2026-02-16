import { auth } from './firebase';

const API_BASE = import.meta.env.VITE_API_BASE || '';
const BASE = `${API_BASE}/api`;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
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
  format: string;
  question: string;
  hint: string | null;
  expected_answer: string;
  explanation: string;
  source_chunk_ids: string[];
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

export interface PracticeResponse {
  practice_id: string;
  question: string;
  choices: { A: string; B: string; C: string; D: string };
  correct: string;
  explanation: string;
  response_time_ms: number;
}

export interface HistoryItem {
  id: string;
  type: 'quiz' | 'practice';
  question: string;
  is_correct: boolean;
  score: number;
  timestamp: string;
  difficulty?: string;
  format?: string;
}

export interface UploadResponse {
  filename: string;
  text_length: number;
  chunks_created: number;
  total_chunks: number;
}

export interface DataSource {
  name: string;
  chunks: number;
}

export interface DataStatusResponse {
  total_chunks: number;
  sources: DataSource[];
}

export interface StatsResponse {
  total_quizzes: number;
  total_practices: number;
  avg_score: number;
  streak_days: number;
  last_active: string | null;
  recent_history: HistoryItem[];
}

export const api = {
  ask: (question: string) => post<AskResponse>('/ask', { question }),

  generateQuiz: (difficulty: string, excludeChunkIds?: string[]) =>
    post<QuizResponse>('/quiz/generate', { difficulty, exclude_chunk_ids: excludeChunkIds || [] }),

  generateQuizBatch: (difficulty: string, count: number = 5) =>
    post<QuizResponse[]>('/quiz/generate-batch', { difficulty, count }),

  evaluateQuiz: (params: {
    quiz_id: string;
    question: string;
    expected_answer: string;
    user_answer: string;
    difficulty: string;
  }) => post<EvalResponse>('/quiz/evaluate', params),

  generatePractice: (difficulty: string = 'beginner') =>
    post<PracticeResponse>('/practice/generate', { count: 1, difficulty }),

  saveQuizResult: (params: {
    quiz_id: string;
    question: string;
    expected_answer: string;
    user_answer: string;
    is_correct: boolean;
    difficulty: string;
  }) => post<{ status: string }>('/quiz/save-result', params),

  savePracticeResult: (params: {
    practice_id: string;
    question: string;
    selected: string;
    correct: string;
    difficulty: string;
  }) => post<{ status: string }>('/practice/answer', params),

  getStats: async (): Promise<StatsResponse> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE}/me/stats`, { headers });
    if (!res.ok) throw new Error('統計情報の取得に失敗しました');
    return res.json();
  },

  uploadFile: async (file: File): Promise<UploadResponse> => {
    const headers = await getAuthHeaders();
    delete headers['Content-Type'];
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE}/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail?.error || err.detail || 'Upload Error');
    }
    return res.json();
  },

  getDataStatus: async (): Promise<DataStatusResponse> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE}/data/status`, { headers });
    if (!res.ok) throw new Error('データ状態の取得に失敗しました');
    return res.json();
  },

  deleteSource: async (sourceName: string): Promise<void> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE}/data/source/${encodeURIComponent(sourceName)}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail?.error || err.detail || 'Delete Error');
    }
  },

  health: () => fetch(`${BASE}/health`).then((r) => r.json()),
};
