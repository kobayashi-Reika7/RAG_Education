/**
 * タスク関連のユーティリティ（VERIFICATION の確認項目 3,6 等に対応）
 * - getDueState: 期限の状態（none / ok / overdue）
 * - computeCounts: 未完了・完了・お気に入り・期限切れの件数
 * - sortTasksByCreatedAt: 未完了を上（新しい順）、完了を下（新しい順）でソート
 */

/**
 * 期限の状態を返す
 * @param {string|null} dueDate - YYYY-MM-DD または null
 * @returns {'none'|'ok'|'overdue'}
 */
export function getDueState(dueDate) {
  if (!dueDate) return 'none';
  const today = new Date().toISOString().slice(0, 10);
  if (dueDate < today) return 'overdue';
  return 'ok';
}

/**
 * タスク一覧からカウンター用の件数を算出
 * 期限切れは「未完了かつ期限切れ」のみカウント（完了済みの期限切れは含めない）
 * @param {Array<{is_completed?: boolean, is_favorite?: boolean, due_date?: string|null}>} tasks
 * @returns {{ incomplete: number, completed: number, favorite: number, overdue: number }}
 */
export function computeCounts(tasks) {
  const incomplete = tasks.filter((t) => !t.is_completed).length;
  const completed = tasks.filter((t) => t.is_completed).length;
  const favorite = tasks.filter((t) => t.is_favorite).length;
  const overdue = tasks.filter(
    (t) => !t.is_completed && getDueState(t.due_date) === 'overdue'
  ).length;
  return { incomplete, completed, favorite, overdue };
}

/**
 * タスクを表示用にソート（未完了を上・新しい順、完了を一番下・新しい順）
 * - 未完了（is_completed: false）を上に、完了を下にまとめる
 * - 同じ状態内では createdAt の新しい順（追加タスクが一番上）
 * - createdAt 未設定（serverTimestamp 反映前）は「最新」として先頭側に
 * @param {Array<{is_completed?: boolean, createdAt?: {toMillis?: ()=>number}|number|null}>} tasks
 * @returns {Array}
 */
export function sortTasksByCreatedAt(tasks) {
  return [...tasks].sort((a, b) => {
    if (a.is_completed !== b.is_completed) {
      return a.is_completed ? 1 : -1;
    }
    const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ?? Infinity);
    const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ?? Infinity);
    return tB - tA;
  });
}
