# Firestore デバッグガイド

「ToDo がリロード・タブ閉じで消える」現象の原因特定・修正手順です。

**本ドキュメントに従った確認用コードは firebase.js / firestore.js に追加済みです。**

---

## ① Firestore 接続確認

### チェック項目

| 項目 | 現状 | 想定 |
|------|------|------|
| initializeApp | ✅ 呼ばれている | firebase.js L19 |
| firebaseConfig | ✅ import.meta.env から取得 | L10-16 |
| getFirestore(app) | ✅ 正しい app を参照 | L23 |
| db export | ✅ 他ファイルから import | firestore.js L21 |

### よくある間違い

- **`import.meta.env` が undefined**: Vite では `VITE_` で始まらない変数は undefined
- **firebase.js の import パス**: `../firebase/firebase` と `../firebase/firebase.js` の違い（多くの環境で同じ）
- **複数回 initializeApp**: エラーになる。1 ファイルで一元管理すること

### 確認用コード（一時追加）

```javascript
// firebase.js の initializeApp の直後に追加
console.log('Firebase config:', {
  hasApiKey: !!import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
});
```

---

## ② .env / 環境変数チェック

### チェック項目

| 項目 | 現状 | 問題ありの場合 |
|------|------|----------------|
| ファイル名 | `.env` | `.env.local` だと Vite の優先度で上書きされる場合あり |
| 変数名 | `VITE_FIREBASE_*` | `FIREBASE_*` だけだと undefined |
| サーバー再起動 | 必要 | .env 変更後は `npm run dev` を再起動 |
| .gitignore | `.env` 含む | ✅ |

### 正しい .env の書き方

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=xxx
VITE_FIREBASE_STORAGE_BUCKET=xxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:xxx
```

**注意**: 値にスペース・引用符は不要。`=` の前後にスペースを入れない。

---

## ③ Firestore 保存（Create）の確認

### チェック項目

| 項目 | 現状 | 想定 |
|------|------|------|
| addDoc | ✅ Promise を返し await/.then で処理 | firestore.js L154-164 |
| エラー握りつぶし | ✅ .catch で setError | App.jsx L109 |
| コレクション名 | `todos` | Firestore と一致 |

### 保存されていない場合の典型パターン

1. **Firestore ルールで write が拒否**
2. **list_id が空**（マイリスト未作成で追加しようとした）
3. **ネットワークエラー**（オフライン等）
4. **別の Firebase プロジェクトを参照**（.env の PROJECT_ID が違う）

### 確認手順

1. タスク追加後、[Firebase Console](https://console.firebase.google.com/) → Firestore → `todos` を開く
2. ドキュメントが増えているか確認
3. 増えていなければ F12 Console でエラーを確認

---

## ④ Firestore 取得（Read / onSnapshot）の確認

### チェック項目

| 項目 | 現状 | 想定 |
|------|------|------|
| コレクション名 | `todos` | Firestore の `todos` と一致 |
| onSnapshot | ✅ subscribeTasks で実行 | firestore.js L136 |
| orderBy | 未使用（クライアントソート） | インデックス不要 |
| createdAt | serverTimestamp() で保存 | 取得時は Timestamp |

### 取得できているが表示されないケース

| 原因 | 説明 | 確認方法 |
|------|------|----------|
| currentListId が空 | TaskList が `list_id === currentListId` でフィルタ。currentListId が '' だと表示されない | リストが先に読み込まれているか |
| list_id の不一致 | タスクの list_id と currentListId が違う | 同じリストを選択しているか |
| エラーで callback([]) | onSnapshot のエラー時、空配列を渡している | Console に「Firestore tasks 監視エラー」が出ていないか |

### 確認用コード（一時追加）

```javascript
// subscribeTasks の callback 内
(snap) => {
  console.log('[DEBUG] tasks snapshot:', snap.docs.length, '件');
  const tasks = snap.docs.map(...);
  callback(tasks);
}
```

---

## ⑤ React 側の状態管理チェック

### チェック項目

| 項目 | 現状 | 想定 |
|------|------|------|
| useEffect cleanup | ✅ return で unsubLists, unsubTasks | App.jsx L88-91 |
| subscribeTasks の return | ✅ unsubscribe 関数を返す | firestore.js L136 |
| setTasks | ✅ callback 内で呼ばれる | App.jsx L65, 81 |
| state 上書き | 問題なし | 別の setState で上書きしていない |

### 注意点

- subscribeTasks は **リスト取得後に呼ぶ**（リストが空のときは addList 後に呼ぶ）
- currentListId が '' の間は TaskList のフィルタで何も表示されない

---

## ⑥ Firestore ルール（超重要）

### 最も可能性が高い原因

**Firestore のセキュリティルールで read / write が拒否されている。**

### 確認手順

1. [Firebase Console](https://console.firebase.google.com/) → プロジェクト選択
2. Firestore Database → ルール
3. 現在のルールを確認

### 開発用ルール例（テストモード）

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 開発用: すべての読み書きを許可（本番では制限すること）
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

### 日付制限付きテストモード（推奨）

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /lists/{listId} {
      allow read, write: if request.time < timestamp.date(2026, 12, 31);
    }
    match /todos/{todoId} {
      allow read, write: if request.time < timestamp.date(2026, 12, 31);
    }
  }
}
```

**重要**: 日付が過ぎると read/write が拒否される。その場合、日付を延長するか上記の `if true` に変更。

---

## ⑦ 結論

### 想定される原因（可能性が高い順）

| # | 原因 | 確認方法 |
|---|------|----------|
| 1 | **Firestore ルールで read 拒否** | Console に「Permission denied」等のエラー |
| 2 | **Firestore ルールで write 拒否** | 追加は画面に出るが Console にエラー、Firestore にデータなし |
| 3 | **.env が読み込まれていない** | console.log(import.meta.env.VITE_FIREBASE_PROJECT_ID) が undefined |
| 4 | **別の Firebase プロジェクトを参照** | PROJECT_ID が Firestore のプロジェクトと一致しているか |
| 5 | **リスト未読み込みで currentListId が空** | TaskList のフィルタで弾かれている |

### 最短で直すチェックリスト

- [ ] 1. Firebase Console → Firestore → ルール を開く
- [ ] 2. `allow read, write: if true;` または日付制限が有効なルールに変更
- [ ] 3. 「ルールを公開」をクリック
- [ ] 4. F12 → Console を開き、タスク追加・リロードしてエラーが出ないか確認
- [ ] 5. Firestore → todos にドキュメントが増えているか確認
- [ ] 6. .env 変更後は `npm run dev` を再起動

### 修正後の確認

1. タスクを追加
2. Firebase Console の `todos` にドキュメントが存在するか確認
3. ページをリロードしてタスクが残るか確認
4. タブを閉じて開き直してタスクが残るか確認
