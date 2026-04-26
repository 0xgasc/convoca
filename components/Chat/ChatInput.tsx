'use client';

import { useState, type FormEvent } from 'react';

interface ChatInputProps {
  onSubmit: (prompt: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSubmit, disabled, placeholder }: ChatInputProps) {
  const [value, setValue] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-neutral-200 bg-white">
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        disabled={disabled}
        placeholder={placeholder ?? 'Ask: "housing actions this weekend"'}
        className="flex-1 px-3 py-2 text-sm rounded border border-neutral-300 text-neutral-900 placeholder:text-neutral-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-neutral-50"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="px-4 py-2 text-sm font-medium rounded bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed"
      >
        Ask
      </button>
    </form>
  );
}
