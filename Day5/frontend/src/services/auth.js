/**
 * Firebase Authentication 関連の処理
 * ログイン・登録・ログアウト・状態監視を services に集約（JSX 内に直接書かない）
 */
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../firebase/firebase';

/**
 * メール・パスワードでログイン
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

/**
 * 新規ユーザー登録（メール・パスワード）
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export function signup(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

/**
 * ログアウト
 * @returns {Promise<void>}
 */
export function logout() {
  return signOut(auth);
}

/**
 * 認証状態の変化を監視（ログイン済みユーザー or null）
 * @param {function(import('firebase/auth').User | null): void} callback
 * @returns {function} unsubscribe
 */
export function subscribeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}
