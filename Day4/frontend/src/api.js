/**
 * バックエンド（FastAPI）への fetch 呼び出し
 * クラウド対応: VITE_API_BASE で本番 API URL を指定（ビルド時に埋め込まれる）
 */
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

/**
 * バックエンド API への共通リクエスト処理
 * @param {string} path - エンドポイントパス（例: '/tasks', '/lists'）
 * @param {RequestInit} [options] - fetch のオプション（method, body など）
 * @returns {Promise<object|void>} レスポンス JSON。204 の場合は undefined
 * @throws {Error} res.ok が false のとき（detail または statusText をメッセージに含む）
 */
function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  }).then((res) => {
    if (!res.ok) {
      return res.json().catch(() => ({})).then((err) => {
        throw new Error(err.detail || res.statusText);
      });
    }
    if (res.status === 204) return;
    return res.json();
  });
}

// ===== タスク API =====
export function getTasks() {
  return request('/tasks');
}

export function createTask(data) {
  return request('/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateTask(id, data) {
  return request(`/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteTask(id) {
  return request(`/tasks/${id}`, { method: 'DELETE' });
}

// ===== リスト API =====
export function getLists() {
  return request('/lists');
}

export function createList(name) {
  return request('/lists', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function deleteList(id) {
  return request(`/lists/${id}`, { method: 'DELETE' });
}
