import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { ChipSelect, SelectInput, TagInput, TextArea, TextInput, TriState, cx } from './ui';

export type Opt = { value: string; label: string };
export type FieldDef =
  | {
      key: string;
      label: string;
      type: 'text' | 'textarea' | 'month' | 'year';
      hint?: string;
      placeholder?: string;
      wide?: boolean;
    }
  | {
      key: string;
      label: string;
      type: 'number';
      hint?: string;
      placeholder?: string;
      wide?: boolean;
      min?: number;
      max?: number;
      step?: number;
    }
  | {
      key: string;
      label: string;
      type: 'select';
      options: Opt[];
      hint?: string;
      wide?: boolean;
      placeholder?: string;
    }
  | {
      key: string;
      label: string;
      type: 'tags';
      hint?: string;
      wide?: boolean;
      suggestions?: string[];
      placeholder?: string;
    }
  | { key: string; label: string; type: 'chips'; options: Opt[]; hint?: string; wide?: boolean }
  | { key: string; label: string; type: 'tristate'; hint?: string; wide?: boolean; yes?: string; no?: string }
  | { key: string; label: string; type: 'checkbox'; hint?: string; wide?: boolean }
  | {
      key: string;
      label: string;
      type: 'list';
      hint?: string;
      wide?: boolean;
      itemFields: FieldDef[];
      itemTitle: (item: any) => string;
      addLabel: string;
      blank: Record<string, unknown>;
    };

export type SectionDef = { title: string; description?: ReactNode; fields: FieldDef[] };

export function FieldControl({
  f,
  value,
  onChange,
  error,
}: {
  f: FieldDef;
  value: any;
  onChange: (v: any) => void;
  error?: string;
}) {
  switch (f.type) {
    case 'text':
      return (
        <TextInput
          label={f.label}
          hint={f.hint}
          placeholder={f.placeholder}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          error={error}
        />
      );
    case 'month':
      return (
        <TextInput
          label={f.label}
          hint={f.hint ?? 'YYYY-MM'}
          type="month"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          error={error}
        />
      );
    case 'year':
      return (
        <TextInput
          label={f.label}
          hint={f.hint}
          inputMode="numeric"
          maxLength={4}
          placeholder="YYYY"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
          error={error}
        />
      );
    case 'textarea':
      return (
        <TextArea
          label={f.label}
          hint={f.hint}
          placeholder={f.placeholder}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          error={error}
        />
      );
    case 'number':
      return (
        <TextInput
          label={f.label}
          hint={f.hint}
          type="number"
          min={f.min}
          max={f.max}
          step={f.step ?? 'any'}
          placeholder={f.placeholder}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          error={error}
        />
      );
    case 'select':
      return (
        <SelectInput
          label={f.label}
          hint={f.hint}
          options={f.options}
          placeholder={f.placeholder ?? 'Not specified'}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          error={error}
        />
      );
    case 'tags':
      return (
        <TagInput
          label={f.label}
          hint={f.hint}
          value={value ?? []}
          onChange={onChange}
          suggestions={f.suggestions}
          placeholder={f.placeholder}
        />
      );
    case 'chips':
      return (
        <ChipSelect
          label={f.label}
          hint={f.hint}
          options={f.options}
          value={value ?? []}
          onChange={onChange}
        />
      );
    case 'tristate':
      return (
        <TriState
          label={f.label}
          hint={f.hint}
          value={value ?? null}
          onChange={onChange}
          yes={f.yes}
          no={f.no}
        />
      );
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 pt-7 text-[15px] text-ink-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-ink-300 text-brand-500"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
          />
          {f.label}
        </label>
      );
    case 'list':
      return <ListEditor f={f} value={value ?? []} onChange={onChange} />;
  }
}

function ListEditor({
  f,
  value,
  onChange,
}: {
  f: Extract<FieldDef, { type: 'list' }>;
  value: any[];
  onChange: (v: any[]) => void;
}) {
  const [open, setOpen] = useState<number | null>(value.length ? null : null);
  const update = (i: number, k: string, v: unknown) =>
    onChange(value.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    setOpen(j);
  };
  return (
    <div>
      <p className="field-label">{f.label}</p>
      {f.hint && <p className="-mt-1 mb-2 text-xs text-ink-400">{f.hint}</p>}
      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={i} className="rounded-lg border border-ink-200 bg-white">
            <div className="flex items-center gap-2 px-4 py-3">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
              >
                <p className="truncate font-semibold">{f.itemTitle(item) || '(Not specified)'}</p>
              </button>
              <button
                type="button"
                className="rounded p-1.5 text-ink-400 hover:bg-ink-100"
                onClick={() => move(i, -1)}
                aria-label="Move up"
                disabled={i === 0}
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded p-1.5 text-ink-400 hover:bg-ink-100"
                onClick={() => move(i, 1)}
                aria-label="Move down"
                disabled={i === value.length - 1}
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded p-1.5 text-ink-400 hover:bg-bad-50 hover:text-bad-500"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                aria-label="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {open === i && (
              <div className="grid grid-cols-1 gap-4 border-t border-ink-100 p-4 sm:grid-cols-2">
                {f.itemFields.map((sf) => (
                  <div
                    key={sf.key}
                    className={cx(
                      (sf.wide || sf.type === 'textarea' || sf.type === 'tags') && 'sm:col-span-2',
                    )}
                  >
                    <FieldControl f={sf} value={item[sf.key]} onChange={(v) => update(i, sf.key, v)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="mt-3 inline-flex items-center gap-1.5 text-[15px] font-semibold text-brand-600 hover:text-brand-700"
        onClick={() => {
          onChange([...value, { ...f.blank }]);
          setOpen(value.length);
        }}
      >
        <Plus className="h-4 w-4" /> {f.addLabel}
      </button>
    </div>
  );
}

export function FormSections({
  sections,
  data,
  onChange,
  errors = {},
}: {
  sections: SectionDef[];
  data: Record<string, any>;
  onChange: (k: string, v: unknown) => void;
  errors?: Record<string, string>;
}) {
  return (
    <div className="space-y-6">
      {sections.map((s) => (
        <section key={s.title} className="card p-5 sm:p-6">
          <h2 className="text-lg font-bold">{s.title}</h2>
          {s.description && <p className="mt-1 text-sm text-ink-500">{s.description}</p>}
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {s.fields.map((f) => (
              <div
                key={f.key}
                className={cx(
                  (f.wide || ['textarea', 'list', 'tags', 'chips'].includes(f.type)) && 'sm:col-span-2',
                )}
              >
                <FieldControl
                  f={f}
                  value={data[f.key]}
                  onChange={(v) => onChange(f.key, v)}
                  error={errors[f.key]}
                />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
