import { useState } from 'react';
import { normalizePinDigits } from '../lib/pin';

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: 'numeric' | 'text';
  maxLength?: number;
  required?: boolean;
  /** Strip non-digits on change (for PIN fields). */
  digitsOnly?: boolean;
};

export default function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
  inputMode,
  maxLength,
  required,
  digitsOnly,
}: Props) {
  const [visible, setVisible] = useState(false);

  const handleChange = (raw: string) => {
    if (digitsOnly) {
      onChange(normalizePinDigits(raw));
      return;
    }
    onChange(maxLength ? raw.slice(0, maxLength) : raw);
  };

  return (
    <div className="password-input-wrap">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        required={required}
      />
      <button
        type="button"
        className="password-input-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide' : 'Show'}
        aria-pressed={visible}
        tabIndex={-1}
      >
        {visible ? '🙈' : '👁'}
      </button>
    </div>
  );
}
