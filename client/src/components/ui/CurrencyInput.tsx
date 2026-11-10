import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatBRL } from '@cozam/shared';

export interface CurrencyInputProps {
  label?: string;
  value?: number | null;
  onChange?: (val: number | null) => void;
  error?: string;
  helperText?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
}

export function CurrencyInput({
  label,
  value,
  onChange,
  error,
  helperText,
  placeholder = 'R$ 0,00',
  disabled,
  required,
  className,
  id,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    if (value !== undefined && value !== null && !Number.isNaN(value)) {
      setDisplayValue(formatBRL(value));
    } else {
      setDisplayValue('');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawDigits = e.target.value.replace(/\D/g, '');
    if (!rawDigits) {
      setDisplayValue('');
      if (onChange) onChange(null);
      return;
    }

    const cents = parseInt(rawDigits, 10);
    const num = cents / 100;
    setDisplayValue(formatBRL(num));
    if (onChange) onChange(num);
  };

  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '_') : undefined);

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      <input
        id={inputId}
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={twMerge(
          clsx(
            'block w-full rounded-lg border bg-white dark:bg-slate-800/90 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 tabular-nums font-medium transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent',
            error ? 'border-rose-400 dark:border-rose-500 focus:ring-rose-500' : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600',
            disabled && 'bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-500 cursor-not-allowed',
            className
          )
        )}
      />
      {error && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400 font-medium">{error}</p>}
      {!error && helperText && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helperText}</p>}
    </div>
  );
}
