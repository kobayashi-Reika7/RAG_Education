/**
 * タスク入力フォーム（追加）
 * 送信時に親の onAdd を呼ぶ。リスト未選択時は追加不可（タスクが表示されないのを防ぐ）
 */
import React, { useState } from 'react';

function TaskForm({ onAdd, disabled }) {
  const [title, setTitle] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (disabled) return;
    const t = title.trim();
    if (!t) return;
    onAdd(t);
    setTitle('');
  };

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={disabled ? 'リスト読み込み中…' : 'タスクを入力'}
        maxLength={200}
        disabled={disabled}
        aria-label="タスクを入力"
      />
      <button type="submit" disabled={disabled}>
        追加
      </button>
    </form>
  );
}

export default TaskForm;
