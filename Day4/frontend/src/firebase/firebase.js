/**
 * Firebase 初期化（Firestore を唯一のデータソースとする構成）
 * 変更理由: analytics は未使用のため削除。getFirestore で Firestore を初期化し、
 * 設定値は import.meta.env 経由で取得。HMR 対策で getApps/getApp により app は一度だけ初期化。
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Vite: 環境変数は import.meta.env.VITE_* で参照（クライアントに公開される）
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (!import.meta.env.VITE_FIREBASE_PROJECT_ID) {
  console.error('[Firebase] VITE_FIREBASE_PROJECT_ID が undefined です。.env を確認し、npm run dev を再起動してください。');
}

// HMR で再実行されても app は一度だけ初期化（getApps/getApp で再利用）
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Firestore を getFirestore で初期化（唯一のデータソース）
const db = getFirestore(app);

export { db };
