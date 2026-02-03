/**
 * Firestore 関数（Create + Realtime Read）
 *
 * - addTodoToDB: async/await で追加
 * - subscribeTodos: onSnapshot でリアルタイム監視
 */
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase/firebase.js';

// コレクション名を定数で管理（typo 防止）
const COLLECTION_NAME = 'todos';

/**
 * Create: 新規 ToDo を Firestore に追加
 *
 * @param {string} title - ToDo のタイトル
 * @returns {Promise<string>} 追加されたドキュメントの ID
 */
export async function addTodoToDB(title) {
  const todosRef = collection(db, COLLECTION_NAME);

  // addDoc は Promise を返すので await で待つ
  const docRef = await addDoc(todosRef, {
    title: title,
    createdAt: new Date(),
  });

  return docRef.id;
}

/**
 * Realtime Read: todos コレクションをリアルタイム監視
 *
 * onSnapshot を使用。データが変更されるたびに callback が呼ばれる。
 * リロード不要で即座に画面が更新される。
 *
 * 【なぜ onSnapshot に await が不要か】
 * - onSnapshot は「リスナー登録」を行う関数で、Promise を返さない
 * - コールバック関数が、初回とデータ変更のたびに非同期で呼ばれる
 * - await する対象（Promise）が存在しないため、await は不要
 * - 代わりに、戻り値の unsubscribe 関数で監視を解除する（useEffect の cleanup で使用）
 *
 * @param {function(todos: Array<{id: string, title: string, createdAt: Date}>): void} callback - データ取得時に呼ばれる
 * @returns {function} unsubscribe - 呼ぶと監視を解除（useEffect の return で使用）
 */
export function subscribeTodos(callback) {
  const todosRef = collection(db, COLLECTION_NAME);

  // createdAt の降順（新しい順）でソート
  const q = query(todosRef, orderBy('createdAt', 'desc'));

  // onSnapshot: リスナーを登録。データ変更のたびに第2引数のコールバックが呼ばれる
  // 戻り値は unsubscribe 関数（呼ぶと監視を解除）
  const unsubscribe = onSnapshot(
    q,
    (querySnapshot) => {
      const todos = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        todos.push({
          id: doc.id,
          title: data.title || '',
          createdAt: data.createdAt?.toDate?.() || new Date(),
        });
      });
      callback(todos);
    },
    (error) => {
      // エラー時も callback を呼んで空配列を渡すか、エラーを伝える
      console.error('Firestore 監視エラー:', error);
      callback([]);
    }
  );

  return unsubscribe;
}
