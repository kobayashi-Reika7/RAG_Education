/**
 * リスト選択・追加・削除
 * Day4: list.id は Firestore の文字列 ID。デフォルトリスト（先頭）は削除不可
 */
import React from 'react';

function ListSelector({ lists, currentListId, defaultListId, onSelect, onAdd, onDelete }) {
  const isDefault = defaultListId !== undefined && currentListId === defaultListId;
  // 削除後などで currentListId が lists に無い場合は表示用に defaultListId を使う
  const selectValue = lists.some((l) => l.id === currentListId)
    ? currentListId
    : (defaultListId || lists[0]?.id || '');

  return (
    <div className="list-section">
      <label htmlFor="listSelect">リスト：</label>
      <select
        id="listSelect"
        value={selectValue}
        onChange={(e) => onSelect(e.target.value)}
      >
        {lists.map((list) => (
          <option key={list.id} value={list.id}>
            {list.name}
          </option>
        ))}
      </select>
      <button type="button" className="btn-add-list" onClick={onAdd}>
        リスト追加
      </button>
      <button
        type="button"
        className="btn-delete-list"
        onClick={onDelete}
        disabled={isDefault}
      >
        リスト削除
      </button>
    </div>
  );
}

export default ListSelector;
