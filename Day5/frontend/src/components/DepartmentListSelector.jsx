/**
 * 診療科一覧（カテゴリ単位表示）
 * グループごとに見出し＋カードで表示。
 * onSelect を渡すとボタン選択モード、渡さないと表示のみ。
 */
import React from 'react';
import { CATEGORIES, DEPARTMENTS_BY_CATEGORY } from '../constants/masterData';

/** カテゴリごとの見出し用アイコン（視認性・医療らしさ） */
const CATEGORY_ICONS = {
  internal: '🫀',
  surgical: '🩹',
  pediatric_women: '👶',
  examination: '🔬',
  rehabilitation: '🦿',
};

/**
 * @param {object} props
 * @param {string} [props.selectedLabel] - 選択中の診療科表示名（onSelect 使用時のみ）
 * @param {(label: string) => void} [props.onSelect] - 渡すとボタン選択モード、省略で表示のみ
 */
export default function DepartmentListSelector({ selectedLabel = '', onSelect }) {
  const selectable = typeof onSelect === 'function';
  const selected = String(selectedLabel ?? '').trim();

  return (
    <div className="dept-selector" role="group" aria-label="診療科一覧">
      {CATEGORIES.map((category) => {
        const departments = DEPARTMENTS_BY_CATEGORY[category.id] ?? [];
        if (departments.length === 0) return null;

        const icon = CATEGORY_ICONS[category.id] ?? '📋';
        return (
          <section
            key={category.id}
            className="dept-selector-section"
            aria-labelledby={`dept-category-${category.id}`}
          >
            <h3
              id={`dept-category-${category.id}`}
              className="dept-selector-heading"
            >
              <span className="dept-selector-heading-icon" aria-hidden>
                {icon}
              </span>
              <span className="dept-selector-heading-text">{category.label}</span>
            </h3>
            <div className="dept-selector-grid" role="list">
              {departments.map((dept) => {
                const isSelected = selectable && dept.label === selected;
                const noWrap = dept.label === '画像診断・検査';
                const textClass = `dept-selector-btn-text${noWrap ? ' dept-selector-text-nowrap' : ''}`;
                return (
                  <div key={dept.id} className="dept-selector-item-wrap" role="listitem">
                    {selectable ? (
                      <button
                        type="button"
                        className={`dept-selector-btn ${isSelected ? 'dept-selector-btn-selected' : ''}`}
                        aria-pressed={isSelected}
                        aria-label={`${dept.label}${isSelected ? 'を選択中' : 'を選択'}`}
                        onClick={() => onSelect(dept.label)}
                      >
                        <span className={textClass}>{dept.label}</span>
                        {isSelected && (
                          <span className="dept-selector-btn-check" aria-hidden>✓</span>
                        )}
                      </button>
                    ) : (
                      <span className="dept-selector-item">
                        <span className={textClass}>{dept.label}</span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
