
import React from 'react';
import { useTranslation } from '../i18n/context';
import type { PromptOption } from '../types';

interface PromptOptionsProps {
  options: PromptOption[];
  selectedValues: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

const PromptOptions: React.FC<PromptOptionsProps> = ({ options, selectedValues, onChange }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 mt-4 p-4 bg-black/20 rounded-lg border border-[var(--border-primary)]">
      {options.map((option) => (
        <div key={option.key}>
          <label htmlFor={`select-${option.key}`} className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
            {t(option.titleKey)}
          </label>
          <select
            id={`select-${option.key}`}
            value={selectedValues[option.key] || 'random'}
            onChange={(e) => onChange(option.key, e.target.value)}
            className="w-full p-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] transition-colors"
          >
            <option value="random">{t('promptOptions.random')}</option>
            {option.values.map((val) => (
              <option key={val.valueKey} value={val.valueKey}>
                {t(val.labelKey)}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
};

export default PromptOptions;
