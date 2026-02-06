/**
 * フォーム共通部品
 * ラベル付き select / input を共通スタイルで表示（複数画面で使い回す）
 */
import React from 'react';

/**
 * ラベル + セレクトボックス
 * @param {{ label: string, value: string, options: Array<{id:string, label:string}>, onChange: function, placeholder?: string, disabled?: boolean }} props
 */
export function SelectField({ label, value, options, onChange, placeholder = '選択してください', disabled }) {
  return (
    <div className="input-form-field">
      <label className="input-form-label">{label}</label>
      <select
        className="input-form-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={label}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * ラベル + テキスト入力（type="email" | "password" | "text"）
 */
export function TextField({ label, type = 'text', value, onChange, placeholder, autoComplete, required }) {
  return (
    <div className="input-form-field">
      <label className="input-form-label">
        {label}
        {required && <span className="input-form-required"> *</span>}
      </label>
      <input
        type={type}
        className="input-form-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        aria-label={label}
      />
    </div>
  );
}
