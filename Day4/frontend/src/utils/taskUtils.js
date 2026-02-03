/**
 * タスク関連のユーティリティ（VERIFICATION の確認項目 3,6 等に対応）
 * - getDueState: 期限の状態（none / ok / overdue）
 * - computeCounts: 未完了・完了・お気に入り・期限切れの件数
 * - sortTasksByCreatedAt: 作成日時の新しい順でソート
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
 * @param {Array<{is_completed?: boolean, is_favorite?: boolean, due_date?: string|null}>} tasks
 * @returns {{ incomplete: number, completed: number, favorite: number, overdue: number }}
 */
export function computeCounts(tasks) {
  const incomplete = tasks.filter((t) => !t.is_completed).length;
  const completed = tasks.filter((t) => t.is_completed).length;
  const favorite = tasks.filter((t) => t.is_favorite).length;
  const overdue = tasks.filter((t) => getDueState(t.due_date) === 'overdue').length;
  return { incomplete, completed, favorite, overdue };
}

/**
 * 作成日時の新しい順でタスクをソート（Firestore Timestamp 対応）
 * @param {Array<{createdAt?: {toMillis?: ()=>number}|number|null}>} tasks
 * @returns {Array}
 */
export function sortTasksByCreatedAt(tasks) {
  return [...tasks].sort((a, b) => {
    const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ?? 0);
    const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ?? 0);
    return tB - tA;
  });
}
