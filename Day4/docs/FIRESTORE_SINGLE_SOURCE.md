# Firestore を唯一のデータソースにした変更まとめ

## 目的

- 現在の ToDo アプリが React の useState だけでローカル管理しており、Firestore に保存されていない可能性があったため、**Firestore を唯一のデータソース**とする構成に修正した。
- サーバー再起動・リロード後もデータが保持されるようにする。

---

## 変更したファイルと理由

### 1. `frontend/src/firebase/firebase.js`

**変更内容**

- **analytics 削除**: 未使用のため削除（元から未使用だったため実質変更なし）。
- **getFirestore で Firestore を初期化**: `initializeFirestore` + 永続キャッシュの代わりに、`getFirestore(app)` のみで初期化。要件どおり「getFirestore を使って Firestore を初期化」する形に統一。
- **設定値は import.meta.env 経由**: 既存どおり `import.meta.env.VITE_FIREBASE_*` で取得。
- **HMR 対策**: `getApps()` / `getApp()` により app は一度だけ初期化し、HMR で再実行されてもエラーにならないようにした。

**理由**: Firebase 初期化をシンプルにし、Firestore を「唯一のデータソース」として使う前提の初期化にそろえた。

---

### 2. `frontend/src/services/firestore.js`

**変更内容**

- **collection を "tasks" に統一**: 従来の `todos` をやめ、要件どおり **"tasks"** を使用。
- **subscribeLists / subscribeTasks を削除**: リアルタイム購読はやめ、**getLists / getTasks の1回取得**のみに変更。CRUD は Firestore に書き込んだあと、App 側で再取得して state を更新する形に統一。
- **getTasks(defaultListId)**: 全タスクを1回取得。`list_id` 欠損時は `fallbackListId` で補う（既存の mapDocToTask の仕様を維持）。
- **addTask / updateTask / deleteTask**: Firestore への書き込みのみ行う。state の更新は呼び出し元（App.jsx）で `getTasks()` 再実行により行う。
- **getLists / addList / deleteList**: リスト選択 UI 用として維持。deleteList 時は `tasks` コレクションの `list_id` を defaultListId に振り替えてからリストを削除する既存ロジックを維持。
- **デバッグ用 console.log 削除**: addTask 内のログを削除。

**理由**: 「Firestore 用の CRUD（getTasks / addTask / updateTask / deleteTask）」を collection "tasks" で提供し、ローカル配列の push ではなく「Firestore に保存 → 再取得で state 更新」に一本化するため。

---

### 3. `frontend/src/App.jsx`

**変更内容**

- **useEffect で getLists() を1回だけ実行**: マウント時のみ `getLists()` を呼び、取得結果を `setLists` で反映。リストが0件のときは `addList(DEFAULT_LIST_NAME)` してから再度 `getLists()` で反映。
- **useEffect で getTasks(listId) を1回だけ実行**: `listId`（currentListId または defaultListId）が決まったときだけ `getTasks(listId)` を実行し、取得結果を `setTasks(sortTasksByCreatedAt(...))` で反映。依存配列は `[listId]` のみで、二重読込・無限ループを防ぐ。
- **タスク追加時**: `addTask()` で Firestore に保存 → 続けて `refreshTasks()`（内部で `getTasks(listId)`）で再取得し state を更新。`setTasks([...tasks, newTask])` のみで完結する処理は削除。
- **タスク更新・削除時**: `updateTask()` / `deleteTask()` のあと同様に `refreshTasks()` で再取得し state を更新。
- **リスト追加・削除時**: `addList()` / `deleteList()` のあと `getLists().then(setLists)` で再取得し state を更新。
- **削除したもの**:
  - ダミーデータ・初期 tasks のローカル専用の扱い（元からなし）。
  - `subscribeLists` / `subscribeTasks` による onSnapshot 購読。
  - `listsLoaded` / `tasksSnapshotReceived` の複合ローディングと 8 秒タイムアウト。
  - `fromCache` 判定、`defaultListCreatedRef`、`tasksSnapshotReceivedRef`、`deletedListIdsRef`（リスト削除は Firestore 削除後に getLists 再実行で反映）。
  - デバッグ用の `console.log` 一式。
- **ローカルだけの処理**: `setTasks([...tasks, newTask])` のみで完結する処理は存在しないようにし、かならず Firestore 保存 → `refreshTasks()` で再取得する形に統一。
- **初期表示**: `isLoading = !listsLoaded || lists.length === 0` とし、リストが1件以上取得できるまで「読み込み中」を表示。タスクは listId が決まったあと1回だけ getTasks で取得。

**理由**: React は「表示と操作」だけを担当し、データの真実は Firestore のみに置く。useState だけで完結させず、取得は getLists / getTasks の1回実行、変更は Firestore 書き込みのあと再取得で反映するようにした。

---

### 4. `frontend/src/components/TaskList.jsx`

**変更内容**

- デバッグ用の `console.log` を削除。

**理由**: 本番用コードとして不要なログをなくすため。

---

## 初期表示が遅くならないようにした点

- **useEffect の依存配列**: リスト取得は `[]`（1回だけ）。タスク取得は `[listId]` のみ。listId が変わるたびに1回だけ getTasks が走るため、不要な二重読込はなし。
- **無限ループ**: getLists / getTasks の結果で setState するが、listId は lists と currentListId から導出されるだけなので、この useEffect 内で listId を書きにいっておらず、無限ループにはならない。
- **二重読込**: getLists はマウント時1回。getTasks は listId 変更時のみ。同一 listId で連続して getTasks が呼ばれることはない。

---

## ゴールの確認

- **Firestore に tasks コレクションが作成される**: `addTask` で `collection(db, "tasks")` に addDoc するため、タスク追加時に tasks コレクションとドキュメントが作成される。
- **ブラウザをリロードしてもタスクが消えない**: データは Firestore にのみ保存され、表示は getTasks() で毎回取得するため、リロード後も同じデータが表示される。
- **React は「表示と操作」だけを担当**: state は Firestore から取得した結果のキャッシュであり、永続化はすべて Firestore 側で行う構成になっている。

---

## 注意（既存データがある場合）

- これまで collection 名が **"todos"** だった場合、今回から **"tasks"** に変更しているため、既存の ToDo データは別コレクションのまま残る。
- 既存データを引き続き表示したい場合は、Firestore 上で `todos` コレクションを `tasks` にリネームするか、マイグレーションで `tasks` にコピーする必要がある。
- 新規で使う場合は、最初から `tasks` にだけデータが入る。
