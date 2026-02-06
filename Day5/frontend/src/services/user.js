/**
 * Firestore ユーザードキュメント（users/{uid}）の保存
 * 新規登録時に users/{uid} に email・createdAt を保存し、DB に登録済みであることを残す
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';

/**
 * ユーザー情報を Firestore の users/{uid} に保存する（新規登録・初回同期用）
 * 初回は email / createdAt / updatedAt、2回目以降は email / updatedAt のみ更新
 * @param {string} uid - Firebase Auth の uid
 * @param {string} email - メールアドレス
 * @returns {Promise<void>}
 */
export async function syncUserToFirestore(uid, email) {
  if (!uid?.trim()) return;
  const ref = doc(db, 'users', uid);
  const now = new Date().toISOString();
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      email: (email || '').trim().toLowerCase(),
      createdAt: now,
      updatedAt: now,
    });
  } else {
    await setDoc(ref, { email: (email || '').trim().toLowerCase(), updatedAt: now }, { merge: true });
  }
}
