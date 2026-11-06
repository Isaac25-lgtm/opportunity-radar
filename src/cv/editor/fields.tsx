import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { rid } from '../../../shared/cv';
import { Button, TextArea, TextInput, cx } from '../../components/ui';

/* ---------------- Generic collapsible list items ---------------- */
export type ItemField<T> = {
  key: keyof T & string;
  label: string;
  type?: 'text' | 'month' | 'textarea' | 'checkbox';
  wide?: boolean;
  placeholder?: string;
  hint?: string;
};

export function Items<T extends { id: string }>({
  items,
  onChange,
  fields,
  title,
  subtitle,
  blank,
  addLabel,
}: {
  items: T[];
  onChange: (v: T[]) => void;
  fields: ItemField<T>[];
  title: (i: T) => string;
  subtitle?: (i: T) => string;
  blank: () => T;
  addLabel: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const set = (id: string, k: keyof T, v: unknown) =>
    onChange(items.map((it) => (it.id === id ? { ...it, [k]: v } : it)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={it.id} className="group/item rounded border border-ink-200">
          <div className="flex items-center">
            <button
              className="min-w-0 flex-1 px-4 py-3.5 text-left"
              onClick={() => setOpen(open === it.id ? null : it.id)}
              aria-expanded={open === it.id}
            >
              <p className={cx('truncate font-semibold', !title(it) && 'text-ink-400')}>
                {title(it) || '(Not specified)'}
              </p>
              {subtitle && subtitle(it) && <p className="truncate text-sm text-ink-400">{subtitle(it)}</p>}
            </button>
            <div className="flex items-center pr-2">
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="rounded p-1.5 text-ink-400 hover:text-ink disabled:opacity-30"
                aria-label="Move up"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === items.length - 1}
                className="rounded p-1.5 text-ink-400 hover:text-ink disabled:opacity-30"
                aria-label="Move down"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                onClick={() => onChange(items.filter((x) => x.id !== it.id))}
                className="rounded p-1.5 text-ink-400 hover:text-bad-500"
                aria-label="Delete entry"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          {open === it.id && (
            <div className="grid grid-cols-1 gap-4 border-t border-ink-100 px-4 pb-5 pt-4 sm:grid-cols-2">
              {fields.map((f) =>
                f.type === 'checkbox' ? (
                  <label key={f.key} className="flex items-center gap-2 text-sm text-ink-700 sm:col-span-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-ink-300"
                      checked={!!it[f.key]}
                      onChange={(e) => set(it.id, f.key, e.target.checked)}
                    />
                    {f.label}
                  </label>
                ) : f.type === 'textarea' ? (
                  <TextArea
                    key={f.key}
                    className="sm:col-span-2"
                    label={f.label}
                    hint={f.hint}
                    placeholder={f.placeholder}
                    rows={6}
                    value={String(it[f.key] ?? '')}
                    onChange={(e) => set(it.id, f.key, e.target.value)}
                  />
                ) : (
                  <TextInput
                    key={f.key}
                    className={f.wide ? 'sm:col-span-2' : ''}
                    label={f.label}
                    type={f.type === 'month' ? 'month' : 'text'}
                    placeholder={f.placeholder}
                    hint={f.hint}
                    value={String(it[f.key] ?? '')}
                    onChange={(e) => set(it.id, f.key, e.target.value)}
                  />
                ),
              )}
            </div>
          )}
        </div>
      ))}
      <button
        onClick={() => {
          const b = blank();
          onChange([...items, b]);
          setOpen(b.id);
        }}
        className="flex items-center gap-1.5 rounded px-1 py-1.5 text-[15px] font-semibold text-brand-600 hover:text-brand-700"
      >
        <Plus className="h-4 w-4" /> {addLabel}
      </button>
    </div>
  );
}

/* ---------------- Skills / languages chips with level ---------------- */
export function LevelItems({
  items,
  onChange,
  levels,
  placeholder,
  addLabel,
}: {
  items: Array<{ id: string; name: string; level: string }>;
  onChange: (v: any[]) => void;
  levels: string[];
  placeholder: string;
  addLabel: string;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const names = draft
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!names.length) return;
    onChange([
      ...items,
      ...names
        .filter((n) => !items.some((i) => i.name.toLowerCase() === n.toLowerCase()))
        .map((name) => ({ id: rid(), name, level: '' })),
    ]);
    setDraft('');
  };
  return (
    <div>
      <div className="space-y-2">
        {items.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <input
              value={s.name}
              onChange={(e) =>
                onChange(items.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)))
              }
              className="input flex-1 py-2.5"
              aria-label="Name"
            />
            <select
              value={s.level}
              onChange={(e) =>
                onChange(items.map((x) => (x.id === s.id ? { ...x, level: e.target.value } : x)))
              }
              className="input w-40 py-2.5"
              aria-label="Level"
            >
              <option value="">Level (optional)</option>
              {levels.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
            <button
              onClick={() => onChange(items.filter((x) => x.id !== s.id))}
              className="rounded p-2 text-ink-400 hover:text-bad-500"
              aria-label={`Remove ${s.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="input flex-1 py-2.5"
          aria-label={addLabel}
        />
        <Button variant="secondary" onClick={add}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
    </div>
  );
}
