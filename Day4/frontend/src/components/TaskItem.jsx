/**
 * 1タスクの表示・編集・削除・お気に入り・期限・タイマー・メモ
 * 状態変更は親の onUpdate を呼び、親が API を呼ぶ（VERIFICATION 確認項目 3〜8）
 */
import React, { useState } from 'react';
import { getDueState } from '../utils/taskUtils';
import Timer from './Timer';
import Memo from './Memo';

function TaskItem({ task, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title ?? '');

  // お気に入り・期限・タイマー・メモは Firestore に無い古いドキュメントでも安全に表示
  const isCompleted = task.is_completed ?? false;
  const isFavorite = task.is_favorite ?? false;
  const dueDate = task.due_date ?? null;
  const memo = task.memo ?? '';
  const time = task.time ?? 0;

  const dueState = getDueState(dueDate);
  const cardClass = [
    'task-card',
    isCompleted && 'completed',
    dueState === 'overdue' && 'overdue',
    isFavorite && 'favorite',
  ]
    .filter(Boolean)
    .join(' ');

  const handleToggleComplete = () => {
    onUpdate(task.id, { is_completed: !isCompleted });
  };

  const handleToggleFavorite = () => {
    onUpdate(task.id, { is_favorite: !isFavorite });
  };

  const handleSaveTitle = () => {
    const t = editTitle.trim();
    if (t) onUpdate(task.id, { title: t });
    setEditing(false);
  };

  const handleDueChange = (e) => {
    const v = e.target.value || null;
    onUpdate(task.id, { due_date: v });
  };

  const handleMemoChange = (memo) => {
    onUpdate(task.id, { memo });
  };

  const handleTimeChange = (time) => {
    onUpdate(task.id, { time });
  };

  return (
    <li className={cardClass}>
      <div className="task-header">
        <input
          type="checkbox"
          checked={task.is_completed}
          onChange={handleToggleComplete}
        />
        {editing ? (
          <input
            type="text"
            className="task-title edit-mode"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
            autoFocus
          />
        ) : (
          <span className="task-title" onDoubleClick={() => setEditing(true)}>
            {task.title ?? ''}
          </span>
        )}
        <button
          type="button"
          className={`btn-favorite ${isFavorite ? 'active' : ''}`}
          onClick={handleToggleFavorite}
          title="お気に入り"
        >
          {isFavorite ? '★' : '☆'}
        </button>
        <button type="button" className="btn-edit" onClick={() => setEditing(!editing)}>
          編集
        </button>
        <button type="button" className="btn-delete" onClick={() => onDelete(task.id)}>
          削除
        </button>
      </div>

      <div className="due-row">
        <input type="date" value={dueDate || ''} onChange={handleDueChange} />
        <span className="due-state">{dueState === 'none' ? '期限なし' : dueState === 'ok' ? '期限内' : '期限切れ'}</span>
      </div>

      <Timer
        taskId={task.id}
        initialTime={time}
        onTimeChange={handleTimeChange}
      />

      <Memo value={memo} onChange={handleMemoChange} />
    </li>
  );
}

export default TaskItem;
