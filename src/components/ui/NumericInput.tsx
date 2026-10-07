import React, { ChangeEvent, KeyboardEvent, FocusEvent } from 'react';
import { Minus, Plus } from 'lucide-react';

export interface NumericInputProps {
  value: number | string;
  onChange: (newValue: any) => void;
  min?: number;
  max?: number;
  step?: number;
  allowDecimal?: boolean;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  placeholder?: string;
  name?: string;
  id?: string;
  showButtons?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChange,
  min = 0,
  max = 999999,
  step = 1,
  allowDecimal = false,
  disabled = false,
  className = '',
  style,
  inputStyle,
  placeholder = '0',
  name,
  id,
  showButtons = true,
  size = 'md',
}) => {
  const numValue = value === '' ? 0 : Number(value) || 0;

  const sanitizeValue = (val: number): number => {
    if (isNaN(val) || !isFinite(val)) return min;
    let clamped = Math.max(min, Math.min(max, val));
    if (!allowDecimal) {
      clamped = Math.floor(clamped);
    } else {
      clamped = Number(clamped.toFixed(2));
    }
    return clamped;
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    if (rawVal === '') {
      onChange('');
      return;
    }
    onChange(rawVal);
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    if (rawVal === '') {
      onChange(min);
      return;
    }
    const parsed = allowDecimal ? parseFloat(rawVal) : parseInt(rawVal, 10);
    if (isNaN(parsed)) {
      onChange(min);
    } else {
      onChange(sanitizeValue(parsed));
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleStepUp();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleStepDown();
    }
  };

  const handleStepUp = () => {
    if (disabled) return;
    const current = value === '' ? min : Number(value) || 0;
    onChange(sanitizeValue(current + step));
  };

  const handleStepDown = () => {
    if (disabled) return;
    const current = value === '' ? min : Number(value) || 0;
    onChange(sanitizeValue(current - step));
  };

  const isMinReached = numValue <= min;
  const isMaxReached = numValue >= max;

  const buttonSize = size === 'sm' ? '28px' : size === 'lg' ? '40px' : '34px';
  const fontSize = size === 'sm' ? '0.8125rem' : size === 'lg' ? '1rem' : '0.875rem';

  return (
    <div
      className={`numeric-input-container ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '2px',
        boxShadow: 'var(--shadow-xs)',
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
    >
      {showButtons && (
        <button
          type="button"
          onClick={handleStepDown}
          disabled={disabled || isMinReached}
          aria-label="Decrease quantity"
          style={{
            width: buttonSize,
            height: buttonSize,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isMinReached || disabled ? 'transparent' : 'var(--bg-subtle)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            color: isMinReached || disabled ? 'var(--text-muted)' : 'var(--text-primary)',
            cursor: isMinReached || disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
        >
          <Minus size={size === 'sm' ? 12 : 14} />
        </button>
      )}

      <input
        type="number"
        name={name}
        id={id}
        value={value}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        min={min}
        max={max}
        step={allowDecimal ? 'any' : step}
        disabled={disabled}
        placeholder={placeholder}
        style={{
          width: showButtons ? '56px' : '100%',
          textAlign: 'center',
          border: 'none',
          background: 'transparent',
          fontSize,
          fontWeight: 700,
          color: 'var(--text-primary)',
          outline: 'none',
          padding: '0 4px',
          MozAppearance: 'textfield',
          ...inputStyle,
        }}
      />

      {showButtons && (
        <button
          type="button"
          onClick={handleStepUp}
          disabled={disabled || isMaxReached}
          aria-label="Increase quantity"
          style={{
            width: buttonSize,
            height: buttonSize,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isMaxReached || disabled ? 'transparent' : 'var(--bg-subtle)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            color: isMaxReached || disabled ? 'var(--text-muted)' : 'var(--text-primary)',
            cursor: isMaxReached || disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
        >
          <Plus size={size === 'sm' ? 12 : 14} />
        </button>
      )}
    </div>
  );
};

