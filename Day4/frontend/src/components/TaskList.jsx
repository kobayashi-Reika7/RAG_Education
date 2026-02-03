/**
 * タスク一覧（現在リストに属するタスクのみ表示）
 * 空のときは何も表示しない（シンプルな学習用）
 */
import React from 'react';
import TaskItem from './TaskItem';

function TaskList({ tasks, currentListId, onUpdate, onDelete }) {
  const filtered = tasks.filter((t) => (t.list_id ?? '') === currentListId);

  return (
    <ul className="task-list">
      {filtered.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}

export default TaskList;
