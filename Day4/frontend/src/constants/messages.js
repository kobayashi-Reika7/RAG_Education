/**
 * 画面表示・プロンプト・エラーメッセージ（VERIFICATION の手順と一致）
 */

/** デフォルトリストの名前（初回はこの名前で1件自動作成） */
export const DEFAULT_LIST_NAME = 'マイリスト';

/** リスト追加時のプロンプト */
export const PROMPT_NEW_LIST_NAME = '新しいリスト名を入力してください';

/** デフォルトリスト削除不可のアラート */
export const ALERT_CANNOT_DELETE_DEFAULT_LIST = 'デフォルトリストは削除できません';

/** リスト削除時の確認文言 */
export const CONFIRM_DELETE_LIST =
  'このリストを削除しますか？\n属するタスクはデフォルトリストに移動します。';

/** エラーメッセージ */
export const ERROR_LOAD_FAILED = '読み込みに失敗しました';
export const ERROR_FIRESTORE_RULES = 'Firestore のルールで読み取りが拒否されています。Firebase Console でルールを確認してください。';
export const ERROR_LIST_NOT_READY = 'リストが読み込まれるまで追加できません。';
export const ERROR_TASKS_FETCH = 'タスクの取得に失敗しました';
export const ERROR_TASKS_ADD = 'タスクの追加に失敗しました';
export const ERROR_TASKS_UPDATE = 'タスクの更新に失敗しました';
export const ERROR_TASKS_DELETE = 'タスクの削除に失敗しました';
export const ERROR_LISTS_FETCH = 'リストの取得に失敗しました';
export const ERROR_LISTS_ADD = 'リストの追加に失敗しました';
export const ERROR_LISTS_DELETE = 'リストの削除に失敗しました';
