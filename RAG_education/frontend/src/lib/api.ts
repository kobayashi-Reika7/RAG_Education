import { fetchAuthSession } from 'aws-amplify/auth';

const API_BASE = import.meta.env.VITE_API_BASE || '';
const BASE = `${API_BASE}/api`;
const CONSISTENCY_ERROR_TEXT = '整合性チェックに失敗しました';

function normalizeQuestionText(text: string): string {
  return text
    .replace(/^\s*(?:問題|問|Q(?:uestion)?)(?:\s*\d+)?\s*[:：]\s*/i, '')
    .trim();
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // not authenticated
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

async function withConsistencyRetry<T>(
  factory: () => Promise<T>,
  maxRetries: number = 1
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await factory();
    } catch (e: unknown) {
      lastError = e;
      const message = e instanceof Error ? e.message : String(e);
      const isConsistencyError = message.includes(CONSISTENCY_ERROR_TEXT);
      if (!isConsistencyError || attempt >= maxRetries) {
        throw e;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('問題生成に失敗しました');
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
  quiz_id?: string;
  practice_id?: string;
  question: string;
  is_correct: boolean;
  score: number;
  timestamp: string;
  difficulty?: string;
  format?: string;
  user_answer?: string;
  expected_answer?: string;
  selected?: string;
  correct?: string;
  choices?: { A?: string; B?: string; C?: string; D?: string };
  explanation?: string;
  feedback?: string;
}

export interface DifficultyStats {
  total: number;
  correct: number;
  accuracy: number;
}

export interface DailyActivity {
  date: string;
  total: number;
  correct: number;
}

export interface StatsResponse {
  total_quizzes: number;
  total_practices: number;
  avg_score: number;
  streak_days: number;
  last_active: string | null;
  quiz_accuracy: number;
  practice_accuracy: number;
  total_correct: number;
  difficulty_stats: Record<string, DifficultyStats>;
  daily_activity: DailyActivity[];
  recent_history: HistoryItem[];
}

export interface S3UploadResponse {
  filename: string;
  bucket: string;
  size: number;
  uri: string;
}

export interface S3File {
  key: string;
  size: number;
  last_modified: string;
  uri: string;
}

export interface S3StatusResponse {
  bucket: string;
  region: string;
  file_count: number;
  total_size: number;
  files: S3File[];
}

export const api = {
  askBedrock: (question: string) => post<AskResponse>('/ask/bedrock', { question }),

  generateQuiz: (difficulty: string, excludeChunkIds?: string[], pastQuestions?: string[]) =>
    withConsistencyRetry(() =>
      post<QuizResponse>('/quiz/generate', {
        difficulty,
        exclude_chunk_ids: excludeChunkIds || [],
        past_questions: pastQuestions || [],
      }).then((res) => ({ ...res, question: normalizeQuestionText(res.question || '') }))
    ),

  generateQuizBatch: (difficulty: string, count: number = 5, pastQuestions?: string[]) =>
    withConsistencyRetry(() =>
      post<QuizResponse[]>('/quiz/generate-batch', {
        difficulty,
        count,
        past_questions: pastQuestions || [],
      }).then((rows) =>
        rows.map((row) => ({ ...row, question: normalizeQuestionText(row.question || '') }))
      )
    ),

  evaluateQuiz: (params: {
    quiz_id: string;
    question: string;
    expected_answer: string;
    user_answer: string;
    difficulty: string;
  }) => post<EvalResponse>('/quiz/evaluate', params),

  generatePractice: (difficulty: string = 'beginner', pastQuestions?: string[]) =>
    withConsistencyRetry(() =>
      post<PracticeResponse>('/practice/generate', {
        count: 1,
        difficulty,
        past_questions: pastQuestions || [],
      }).then((res) => ({ ...res, question: normalizeQuestionText(res.question || '') }))
    ),

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
    choices?: { A: string; B: string; C: string; D: string };
    explanation?: string;
  }) => post<{ status: string }>('/practice/answer', params),

  getStats: async (): Promise<StatsResponse> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE}/me/stats`, { headers });
    if (!res.ok) throw new Error('統計情報の取得に失敗しました');
    return res.json();
  },

  health: () => fetch(`${BASE}/health`).then((r) => r.json()),

  // --- S3 データソース (Bedrock Knowledge Bases) ---

  s3Upload: async (file: File): Promise<S3UploadResponse> => {
    const headers = await getAuthHeaders();
    delete headers['Content-Type'];
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE}/s3/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail?.error || err.detail || 'S3 Upload Error');
    }
    return res.json();
  },

  s3Status: async (): Promise<S3StatusResponse> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE}/s3/status`, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail?.error || err.detail || 'S3 Status Error');
    }
    return res.json();
  },

  s3Delete: async (fileKey: string): Promise<void> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE}/s3/file/${encodeURIComponent(fileKey)}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail?.error || err.detail || 'S3 Delete Error');
    }
  },
};
