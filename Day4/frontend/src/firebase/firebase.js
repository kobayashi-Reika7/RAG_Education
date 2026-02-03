/**
 * Firebase 初期化
 * 【読み込み短縮】enableIndexedDbPersistence でオフライン永続化を有効化。
 * リロード時にキャッシュから即時表示し、バックグラウンドでサーバーと同期。
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

// Viteでは .env の変数は import.meta.env.VITE_* で参照する（クライアントに公開される）
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// デバッグ: 環境変数が undefined なら警告（リロード後も消える原因になりやすい）
if (!import.meta.env.VITE_FIREBASE_PROJECT_ID) {
  console.error('[Firebase] VITE_FIREBASE_PROJECT_ID が undefined です。.env を確認し、npm run dev を再起動してください。');
}

// アプリを1回だけ初期化（複数回呼ぶとエラーになるため、このファイルで一元管理）
const app = initializeApp(firebaseConfig);

// ① 確認用: Firebase 接続が正しく設定されているか（デバッグ後は削除可）
console.log('Firebase config:', {
  hasApiKey: !!import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
});

// Firestore インスタンスを取得
const db = getFirestore(app);

// オフライン永続化: リロード時にキャッシュから即時表示、読み込み時間を短縮
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Firestore 永続化: 複数タブが開いているためスキップ');
  }
});

export { db };
