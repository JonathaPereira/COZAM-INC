import { useState, useEffect } from 'react';
import { Building2, Plus, Check } from 'lucide-react';
import { api } from '../../lib/api';

const DEFAULT_MUNICIPALITIES = [
  'Santana do Mundaú',
  'Branquinha',
  'União dos Palmares',
  'Carneiros',
];

interface MunicipalitySelectProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  label?: string;
  placeholder?: string;
  className?: string;
}

export function MunicipalitySelect({
  value,
  onChange,
  error,
  required = false,
  label = 'Município Consorciado',
  placeholder = 'Selecione o município...',
  className = '',
}: MunicipalitySelectProps) {
  const [municipalities, setMunicipalities] = useState<string[]>(DEFAULT_MUNICIPALITIES);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');

  useEffect(() => {
    let mounted = true;
    api
      .get<{ municipalities: string[] }>('/invoices/municipalities')
      .then((res) => {
        if (mounted && res.municipalities && res.municipalities.length > 0) {
          const merged = Array.from(new Set([...DEFAULT_MUNICIPALITIES, ...res.municipalities])).sort((a, b) =>
            a.localeCompare(b, 'pt-BR')
          );
          setMunicipalities(merged);
        }
      })
      .catch(() => {
        // Fallback para os 4 oficiais
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Se o valor fornecido não estiver na lista padrão, habilita modo customizado
  useEffect(() => {
    if (value && !municipalities.includes(value)) {
      setIsCustomMode(true);
      setCustomValue(value);
    }
  }, [value, municipalities]);

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (val === '__NEW__') {
      setIsCustomMode(true);
      setCustomValue('');
      onChange('');
    } else {
      setIsCustomMode(false);
      onChange(val);
    }
  }

  function handleCustomConfirm() {
    const trimmed = customValue.trim();
    if (trimmed) {
      if (!municipalities.includes(trimmed)) {
        setMunicipalities((prev) => [...prev, trimmed].sort((a, b) => a.localeCompare(b, 'pt-BR')));
      }
      onChange(trimmed);
      setIsCustomMode(false);
    }
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            {label}
            {required && <span className="text-rose-500">*</span>}
          </span>
        </label>
      )}

      {isCustomMode ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customValue}
            onChange={(e) => {
              setCustomValue(e.target.value);
              onChange(e.target.value);
            }}
            placeholder="Digite o nome do novo município..."
            className="flex-1 px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors"
            autoFocus
          />
          <button
            type="button"
            onClick={handleCustomConfirm}
            className="inline-flex items-center gap-1 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            title="Confirmar município"
          >
            <Check className="w-4 h-4" />
            OK
          </button>
          <button
            type="button"
            onClick={() => {
              setIsCustomMode(false);
              onChange('');
            }}
            className="px-2.5 py-2.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            Voltar à lista
          </button>
        </div>
      ) : (
        <div className="relative">
          <select
            value={value}
            onChange={handleSelectChange}
            className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors appearance-none"
          >
            <option value="">{placeholder}</option>
            <optgroup label="Municípios Consorciados">
              {municipalities.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </optgroup>
            <option value="__NEW__" className="text-emerald-600 dark:text-emerald-400 font-semibold">
              + Cadastrar Outro Município...
            </option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500 dark:text-slate-400">
            <Plus className="w-4 h-4" />
          </div>
        </div>
      )}

      {error && <p className="text-xs text-rose-500 dark:text-rose-400">{error}</p>}
    </div>
  );
}
