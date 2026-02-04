/**
 * Firestore を唯一のデータソースとする CRUD
 * 変更理由: collection を "tasks" に統一。getTasks / addTask / updateTask / deleteTask を提供し、
 * ローカル配列の push ではなく Firestore への書き込み → 再取得で state を更新する構成にする。
 * リスト用は getLists / addList / deleteList（リスト選択 UI 用）。
 */
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';

const LISTS = 'lists';
const TASKS = 'tasks';

// ========== リスト（リスト選択 UI 用） ==========

const DEFAULT_LIST_NAME = 'マイリスト';

export function getLists() {
  const ref = collection(db, LISTS);
  return getDocs(ref).then((snap) => {
    const items = snap.docs.map((d) => ({
      id: d.id,
      name: (d.data().name ?? '').trim() || '（無題）',
    }));
    return [...items].sort((a, b) => {
      const aDefault = a.name === DEFAULT_LIST_NAME ? 0 : 1;
      const bDefault = b.name === DEFAULT_LIST_NAME ? 0 : 1;
      return aDefault - bDefault;
    });
  });
}

export function addList(name) {
  const ref = collection(db, LISTS);
  const payload = { name: (name ?? '').trim() || '（無題）' };
  return addDoc(ref, payload).then((docRef) => ({
    id: docRef.id,
    name: payload.name,
  }));
}

export function deleteList(listId, defaultListId) {
  const taskRef = collection(db, TASKS);
  const q = query(taskRef, where('list_id', '==', listId));
  return getDocs(q)
    .then((snap) => {
      const batch = writeBatch(db);
      snap.docs.forEach((d) => {
        batch.update(doc(db, TASKS, d.id), { list_id: defaultListId });
      });
      return batch.commit();
    })
    .then(() => deleteDoc(doc(db, LISTS, listId)));
}

// ========== タスク（Firestore を唯一のデータソース） ==========

/**
 * 全タスクを1回取得。list_id 欠損時は fallbackListId で補う。
 */
export function getTasks(fallbackListId = '') {
  const ref = collection(db, TASKS);
  return getDocs(ref).then((snap) =>
    snap.docs.map((d) => mapDocToTask(d, fallbackListId))
  );
}

function mapDocToTask(d, fallbackListId) {
  const data = d.data();
  return {
    id: d.id,
    title: data.title ?? '',
    list_id: data.list_id ?? fallbackListId,
    is_completed: Boolean(data.is_completed),
    is_favorite: Boolean(data.is_favorite),
    due_date: data.due_date ?? null,
    memo: data.memo ?? '',
    time: Number(data.time) || 0,
    createdAt: data.createdAt ?? null,
  };
}

/**
 * タスクを1件追加。Firestore に保存するだけ（state 更新は App で getTasks 再実行）。
 */
export function addTask({ title, list_id, is_completed = false, is_favorite = false, due_date = null, memo = '', time = 0 }) {
  const ref = collection(db, TASKS);
  return addDoc(ref, {
    title: String(title ?? '').trim(),
    list_id: String(list_id ?? ''),
    is_completed: Boolean(is_completed),
    is_favorite: Boolean(is_favorite),
    due_date: due_date ?? null,
    memo: String(memo ?? ''),
    time: Number(time) || 0,
    createdAt: serverTimestamp(),
  }).then((docRef) => docRef.id);
}

/**
 * タスクを更新。Firestore に反映（state 更新は App で getTasks 再実行）。
 */
export function updateTask(id, data) {
  const ref = doc(db, TASKS, id);
  const payload = { ...data };
  if (payload.title !== undefined) payload.title = String(payload.title).trim();
  return updateDoc(ref, payload);
}

/**
 * タスクを1件削除。Firestore から削除（state 更新は App で getTasks 再実行）。
 */
export function deleteTask(id) {
  return deleteDoc(doc(db, TASKS, id));
}
