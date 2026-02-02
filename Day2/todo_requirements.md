# ToDoアプリ 追加機能 設計・仕様書

## 1. 追加機能の仕様説明

### 1.1 タスク表示順の改善
- **仕様**: 新規追加タスクはリストの**先頭**に表示する。
- **実装**: 配列の先頭に挿入するため `tasks.unshift(newTask)` を使用する（`push` の代わり）。
- **複雑なソートは使わない**: 追加時のみ「先頭に挿入」で対応。

---

### 1.2 期限（締切）機能
- **仕様**:
  - 各タスクに期限（日付）を任意で設定できる。未設定でもタスク作成可能。
  - 入力は `<input type="date">` を使用。
  - 状態: **期限なし** / **期限内** / **期限切れ**（現在日付を過ぎている）。
- **判定**: 今日の日付（時刻は 0:00 で比較）と `dueDate`（YYYY-MM-DD）を比較。
- **表示**: 期限切れタスクは文字色変更または「期限切れ」ラベルで視覚的に区別。

---

### 1.3 リスト機能（グループ化）
- **仕様**:
  - タスクを「リスト（カテゴリ）」ごとに分ける。
  - リストの追加・削除ができる。
  - 各タスクは必ずどれか 1 つのリストに属する。
  - 初期状態で「デフォルトリスト」を 1 つ用意する。
  - リストを切り替えると、そのリストに属するタスクだけを表示する。
- **実装**: 表示時に `tasks.filter(function (t) { return t.listId === currentListId; })` で絞り込む。

---

### 1.4 お気に入り機能
- **仕様**:
  - 各タスクに「お気に入り」フラグ（boolean）を付ける。
  - 星アイコンまたはボタンで ON/OFF 切り替え。
  - お気に入り状態は localStorage に保存する。
  - お気に入りタスクは視覚的に分かるようにする（例: 星の色、背景色）。
- **実装**: `task.isFavorite` をトグルし、保存・描画で反映。

---

### 1.5 カウンター機能の拡張
- **表示項目**: 未完了数 / 完了数 / お気に入り数 / 期限切れ数。
- **仕様**: タスク状態が変わるたびにリアルタイムで再計算。値は保存せず起動時に再計算。
- **実装**: `filter` + `length` で各数を算出する（1 関数で 4 つ返す）。

---

## 2. データ構造の拡張例

### タスク（拡張後）
```javascript
{
  id: 1,
  title: "タスク名",
  isCompleted: false,
  isFavorite: false,
  dueDate: null,           // または "2026-02-15"（YYYY-MM-DD）
  listId: 1,
  memo: "",
  elapsedSeconds: 0        // タイマー用（保存しない）
}
```

### リスト
```javascript
{
  listId: 1,
  listName: "デフォルトリスト"
}
```

### 保存するデータ（localStorage）
- **タスク**: id, title, isCompleted, isFavorite, dueDate, listId, memo（elapsedSeconds は保存しない）
- **リスト一覧**: 配列で `[{ listId, listName }, ...]`

### 既存データの移行
- 既存の保存データに `listId` / `isFavorite` / `dueDate` がない場合:
  - `listId`: 1（デフォルトリスト）を設定
  - `isFavorite`: false
  - `dueDate`: null

---

## 3. 既存コードの追加・修正箇所

| 箇所 | 内容 |
|------|------|
| **データ定義** | `lists`, `nextListId`, `currentListId`, `DEFAULT_LIST_ID` を追加。タスクに `isFavorite`, `dueDate`, `listId` を追加。 |
| **loadTasks** | 復元時に `isFavorite`, `dueDate`, `listId` を付与（無ければデフォルト値）。リスト用の load を追加。 |
| **saveTasks** | 保存対象に `isFavorite`, `dueDate`, `listId` を含める。リストを別キーで保存。 |
| **addTask** | `tasks.unshift(newTask)` に変更。`listId: currentListId`, `dueDate: null`, `isFavorite: false` を付与。 |
| **getTaskCounts** | filter で「未完了・完了・お気に入り・期限切れ」の 4 つを算出して返す。 |
| **updateCounterDisplay** | 4 つの span を更新する。 |
| **renderTasks** | ① 表示対象を `currentListId` でフィルタ。② 各カードに「期限入力」「期限状態ラベル」「お気に入りボタン」を追加。③ 期限切れならカードにクラス付与。 |
| **HTML** | カウンター行に「お気に入り」「期限切れ」の 2 つを追加。リスト選択 UI（select + リスト追加・削除）を追加。 |
| **新規関数** | `getDueDateState(dueDate)`, `toggleFavorite(taskId)`, `setTaskDueDate(taskId, value)`, `getLists()`, `addList(name)`, `deleteList(listId)`, `setCurrentList(listId)` |

---

## 4. 関数一覧（1 機能 = 1 関数）

- **期限**: `getDueDateState(dueDate)` → `"none"` | `"ok"` | `"overdue"`
- **お気に入り**: `toggleFavorite(taskId)`
- **期限設定**: `setTaskDueDate(taskId, dateStringOrNull)`
- **リスト取得**: `getLists()` → 配列
- **リスト追加**: `addList(listName)`
- **リスト削除**: `deleteList(listId)`（デフォルトは削除不可、属するタスクはデフォルトへ）
- **リスト切り替え**: `setCurrentList(listId)` → 表示リストを切り替え再描画
- **カウンター**: `getTaskCounts()` → `{ incomplete, completed, favorite, overdue }`（filter + length で算出）

---

## 5. JavaScript 実装例（コメント付き）

### 期限状態の判定（1 機能 = 1 関数）
```javascript
// dueDate: null または "YYYY-MM-DD"。戻り値: "none" | "ok" | "overdue"
function getDueDateState(dueDate) {
  if (dueDate === null || dueDate === "") return "none";
  var today = new Date();
  var todayStr = today.getFullYear() + "-" + ("0" + (today.getMonth() + 1)).slice(-2) + "-" + ("0" + today.getDate()).slice(-2);
  if (dueDate < todayStr) return "overdue";
  return "ok";
}
```

### カウンター（filter + length で再計算）
```javascript
function getTaskCounts() {
  var incomplete = tasks.filter(function (t) { return !t.isCompleted; }).length;
  var completed = tasks.filter(function (t) { return t.isCompleted; }).length;
  var favorite = tasks.filter(function (t) { return t.isFavorite; }).length;
  var overdue = tasks.filter(function (t) { return getDueDateState(t.dueDate) === "overdue"; }).length;
  return { incomplete: incomplete, completed: completed, favorite: favorite, overdue: overdue };
}
```

### 新規タスクを先頭に追加（配列操作のみ）
```javascript
function addTask() {
  // ... 入力取得 ...
  var newTask = { id: nextId, title: title, isCompleted: false, isFavorite: false, dueDate: null, listId: currentListId, memo: "", elapsedSeconds: 0 };
  tasks.unshift(newTask);  // 先頭に挿入（push ではなく unshift）
  nextId += 1;
  saveTasks();
  renderTasks();
}
```

### 表示タスクの絞り込み（リスト切り替え）
```javascript
function getTasksForCurrentList() {
  return tasks.filter(function (t) { return t.listId === currentListId; });
}
// renderTasks() 内で displayTasks = getTasksForCurrentList() として描画
```
