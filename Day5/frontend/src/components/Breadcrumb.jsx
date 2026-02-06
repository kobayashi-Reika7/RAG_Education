import React from 'react';
import { Link } from 'react-router-dom';

/**
 * パンくずリスト
 * items: [{ label: string, to?: string, onClick?: () => void }]
 * - to がある場合は Link
 * - onClick がある場合は button（state を維持した遷移に使う）
 * - 最後の要素は現在地として表示（リンク無し）
 */
function Breadcrumb({ items = [] }) {
  const safe = Array.isArray(items) ? items.filter(Boolean) : [];
  if (safe.length === 0) return null;
  const lastIdx = safe.length - 1;

  return (
    <nav className="breadcrumb" aria-label="パンくず">
      {safe.map((it, idx) => {
        const label = it?.label ?? '';
        const to = it?.to ?? '';
        const onClick = typeof it?.onClick === 'function' ? it.onClick : null;
        const isLast = idx === lastIdx;

        return (
          <React.Fragment key={`${label}-${idx}`}>
            {idx !== 0 && <span className="breadcrumb-sep" aria-hidden>＞</span>}
            {isLast || !to ? (
              <span className="breadcrumb-current" aria-current="page">{label}</span>
            ) : onClick ? (
              <button type="button" className="breadcrumb-link breadcrumb-btn" onClick={onClick}>
                {label}
              </button>
            ) : (
              <Link to={to} className="breadcrumb-link">{label}</Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export default Breadcrumb;

