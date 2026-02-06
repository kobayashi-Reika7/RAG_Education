# 診療科一覧選択 UI

## UI構造

- **全体**: `dept-selector`（縦スクロール、カテゴリごとにセクション）
- **セクション**: カテゴリ1つ＝1ブロック
  - **見出し**: `dept-selector-heading`（薄い背景 `--page-bg-subtle` ＋ アイコン ＋ カテゴリ名）
  - **グリッド**: `dept-selector-grid`（診療科をカード/ボタンで表示）
- **診療科**: `dept-selector-btn`（1タップで選択、選択中は枠線＋背景色＋✓）

## カテゴリ付きデザイン

| カテゴリ     | アイコン | 診療科例 |
|-------------|----------|----------|
| 内科系      | 🫀       | 循環器内科、消化器内科、呼吸器内科、腎臓内科、神経内科 |
| 外科系      | 🩹       | 整形外科、眼科、耳鼻咽喉科、皮膚科、泌尿器科 |
| 小児・女性  | 👶       | 小児科、産婦人科 |
| 検査        | 🔬       | 画像診断・検査、臨床検査 |
| リハビリ    | 🦿       | リハビリテーション科 |

- レイアウト: スマホ 2 カラム / タブレット 3 カラム / PC 4 カラム
- 配色: 白背景、淡いブルー・グレー（`--medical-blue`, `--page-bg-subtle`, `--medical-border`）
- 選択状態: 枠線（2px）＋背景色＋チェックマーク（色だけに依存しない）

## データ設計

- `constants/masterData.js`: `CATEGORIES` と `DEPARTMENTS_BY_CATEGORY` でカテゴリ構造を管理
- コンポーネントは `map` で描画。診療科の追加・変更はマスタのみ修正

## アクセシビリティ

- 診療科は `<button>`（タップ領域 48px 以上）
- `aria-pressed` で選択状態、`aria-label` で「〇〇を選択」「〇〇を選択中」
- 選択は枠線・背景・✓ で表現（色だけに依存しない）

## Tailwind を使う場合の例

プロジェクトに Tailwind を導入する場合のクラス例（同じ見た目を再現）:

```jsx
// 見出し例
<h3 className="flex items-center gap-2 py-2.5 px-4 text-base font-bold text-sky-800 bg-slate-50 border-b border-sky-200">
  <span aria-hidden>{icon}</span>
  <span>{category.label}</span>
</h3>

// グリッド例（スマホ2 / PC4）
<div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-4">
  {departments.map((dept) => (
    <button
      type="button"
      className={`min-h-[48px] flex items-center justify-between rounded-lg border-2 px-3 py-2.5 text-[0.95rem] font-medium
        ${isSelected
          ? 'border-sky-500 bg-sky-50 text-sky-800'
          : 'border-sky-200 bg-white text-gray-700 hover:bg-slate-50 hover:border-sky-100'
        }`}
      aria-pressed={isSelected}
      aria-label={`${dept.label}${isSelected ? 'を選択中' : 'を選択'}`}
    >
      <span>{dept.label}</span>
      {isSelected && <span className="text-sky-600 font-bold">✓</span>}
    </button>
  ))}
</div>
```

現在の実装は既存の `App.css` の CSS 変数（`--medical-*`, `--page-bg-*`）を使用しており、Tailwind 未導入でも同じデザインで動作します。
