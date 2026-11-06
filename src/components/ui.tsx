import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { ApiError } from '../lib/api';

export function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cx('btn', `btn-${size}`, `btn-${variant}`, className)}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  ...rest
}: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link {...rest} className={cx('btn', `btn-${size}`, `btn-${variant}`, className)} />;
}

export function Spinner({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div className={cx('flex items-center justify-center gap-2 py-10 text-ink-500', className)} role="status">
      <Loader2 className="h-5 w-5 animate-spin text-brand-500" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1 text-xs font-medium text-bad-700" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({
  label,
  hint,
  error,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode; hint?: ReactNode; error?: string | null }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} className={className} htmlFor={rest.id ?? id}>
      <input
        id={rest.id ?? id}
        {...rest}
        aria-invalid={!!error || undefined}
        className={cx('input', error && 'input-error')}
      />
    </Field>
  );
}

export function TextArea({
  label,
  hint,
  error,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} className={className} htmlFor={rest.id ?? id}>
      <textarea
        id={rest.id ?? id}
        rows={5}
        {...rest}
        aria-invalid={!!error || undefined}
        className={cx('input min-h-[110px] resize-y leading-relaxed', error && 'input-error')}
      />
    </Field>
  );
}

export function SelectInput({
  label,
  hint,
  error,
  className,
  options,
  placeholder,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} className={className} htmlFor={rest.id ?? id}>
      <select
        id={rest.id ?? id}
        {...rest}
        className={cx('input appearance-none bg-[length:16px] pr-10', error && 'input-error')}
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 20 20%27 fill=%27%23656e83%27%3E%3Cpath d=%27M5.5 7.5l4.5 4.5 4.5-4.5%27 stroke=%27%23656e83%27 stroke-width=%271.6%27 fill=%27none%27/%3E%3C/svg%3E")',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 14px center',
        }}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Chips input: Enter or comma adds; Backspace on empty removes last. */
export function TagInput({
  label,
  hint,
  value,
  onChange,
  placeholder = 'Type and press Enter',
  suggestions = [],
  max = 60,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  max?: number;
}) {
  const [draft, setDraft] = useState('');
  const id = useId();
  const add = (raw: string) => {
    const parts = raw
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const next = [...value];
    for (const p of parts)
      if (!next.some((x) => x.toLowerCase() === p.toLowerCase()) && next.length < max)
        next.push(p.slice(0, 120));
    onChange(next);
    setDraft('');
  };
  const sugg = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase())).slice(0, 8);
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <div className="input flex min-h-[50px] flex-wrap items-center gap-1.5 py-2">
        {value.map((t) => (
          <span key={t} className="chip bg-white text-ink-700 shadow-sm">
            {t}
            <button
              type="button"
              aria-label={`Remove ${t}`}
              className="rounded-full p-0.5 text-ink-400 hover:text-bad-500"
              onClick={() => onChange(value.filter((x) => x !== t))}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ',') && draft.trim()) {
              e.preventDefault();
              add(draft);
            } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => draft.trim() && add(draft)}
          placeholder={value.length ? '' : placeholder}
          className="min-w-[120px] flex-1 border-0 bg-transparent p-1 text-[15px] outline-none placeholder:text-ink-400"
        />
      </div>
      {sugg.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sugg.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="chip border border-ink-200 bg-white text-ink-600 hover:border-brand-500 hover:text-brand-600"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </Field>
  );
}

export function ChipSelect<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  options: Array<{ value: T; label: string }>;
  value: T[];
  onChange: (v: T[]) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex flex-wrap gap-2" role="group">
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
              className={cx(
                'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                on
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-ink-200 bg-white text-ink-600 hover:border-brand-300',
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </Field>
  );
}

export function TriState({
  label,
  hint,
  value,
  onChange,
  yes = 'Yes',
  no = 'No',
}: {
  label: ReactNode;
  hint?: ReactNode;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  yes?: string;
  no?: string;
}) {
  const opts: Array<[boolean | null, string]> = [
    [true, yes],
    [false, no],
    [null, 'Not specified'],
  ];
  return (
    <Field label={label} hint={hint}>
      <div className="inline-flex rounded bg-ink-100 p-1" role="radiogroup">
        {opts.map(([v, l]) => (
          <button
            key={String(v)}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={cx(
              'rounded px-3.5 py-1.5 text-sm font-medium',
              value === v ? 'bg-white text-ink shadow-sm' : 'text-ink-500 hover:text-ink',
            )}
          >
            {l}
          </button>
        ))}
      </div>
    </Field>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div>
        <label htmlFor={id} className="text-[15px] font-medium text-ink">
          {label}
        </label>
        {description && <p className="text-sm text-ink-500">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-6 w-11 flex-none rounded-full transition-colors',
          checked ? 'bg-brand-500' : 'bg-ink-300',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: 'info' | 'warn' | 'bad' | 'ok';
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const map = {
    info: ['bg-brand-50 text-brand-800', Info],
    warn: ['bg-warn-50 text-warn-700', AlertTriangle],
    bad: ['bg-bad-50 text-bad-700', XCircle],
    ok: ['bg-ok-50 text-ok-700', CheckCircle2],
  } as const;
  const [cls, Icon] = map[tone];
  return (
    <div
      className={cx('flex gap-3 rounded-lg px-4 py-3 text-sm', cls, className)}
      role={tone === 'bad' ? 'alert' : 'status'}
    >
      <Icon className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>}
      </div>
    </div>
  );
}

export function ErrorAlert({ error, className }: { error: unknown; className?: string }) {
  if (!error) return null;
  const msg =
    error instanceof ApiError ? error.message : error instanceof Error ? error.message : String(error);
  const upgrade = error instanceof ApiError && error.status === 402;
  return (
    <Alert
      tone={upgrade ? 'warn' : 'bad'}
      className={className}
      title={upgrade ? 'Upgrade required' : undefined}
    >
      {msg}{' '}
      {upgrade && (
        <Link to="/pricing" className="font-semibold underline">
          Compare plans
        </Link>
      )}
    </Alert>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border-2 border-dashed border-ink-200 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-ink-300">{icon}</div>}
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {children && <div className="mt-1 max-w-md text-sm text-ink-500">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Progress({ value, className, tone }: { value: number; className?: string; tone?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const color =
    tone ?? (v >= 80 ? 'bg-ok-500' : v >= 50 ? 'bg-brand-500' : v >= 25 ? 'bg-warn-500' : 'bg-bad-500');
  return (
    <div
      className={cx('h-1.5 w-full overflow-hidden rounded-full bg-ink-200', className)}
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cx('h-full rounded-full transition-all duration-500', color)}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-ink sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: Array<{ value: T; label: ReactNode }>;
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cx('flex gap-1 overflow-x-auto border-b border-ink-200', className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cx(
            '-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-[15px] font-semibold transition-colors',
            value === t.value
              ? 'border-brand-500 text-brand-600'
              : 'border-transparent text-ink-500 hover:text-ink',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const t = setTimeout(
      () => ref.current?.querySelector<HTMLElement>('input,textarea,select,button')?.focus(),
      30,
    );
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
      document.body.style.overflow = '';
      prev?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={cx(
          'flex max-h-[92vh] w-full flex-col rounded-t-xl bg-white shadow-paper sm:rounded-xl',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg',
        )}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/* In-page confirmation (no browser dialogs). */
export function useConfirm() {
  const [state, setState] = useState<{
    title: string;
    body: ReactNode;
    confirm: string;
    danger: boolean;
    resolve: (v: boolean) => void;
  } | null>(null);
  const confirm = useCallback(
    (title: string, body: ReactNode, opts: { confirm?: string; danger?: boolean } = {}) =>
      new Promise<boolean>((resolve) =>
        setState({ title, body, confirm: opts.confirm ?? 'Confirm', danger: !!opts.danger, resolve }),
      ),
    [],
  );
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  const dialog = (
    <Modal
      open={!!state}
      onClose={() => close(false)}
      title={state?.title ?? ''}
      footer={
        <>
          <Button variant="ghost" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
            {state?.confirm}
          </Button>
        </>
      }
    >
      <div className="text-[15px] text-ink-600">{state?.body}</div>
    </Modal>
  );
  return { confirm, dialog };
}

/* Toasts */
type Toast = { id: number; text: string; tone: 'ok' | 'bad' | 'info' };
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, text, tone }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto rounded-lg px-4 py-3 text-sm font-medium text-white shadow-paper',
              t.tone === 'bad' ? 'bg-bad-700' : t.tone === 'info' ? 'bg-ink' : 'bg-ok-700',
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* Data loading hook */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fn()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { data, error, loading, reload: () => setN((x) => x + 1), setData };
}

export function Pagination({
  page,
  pages,
  onPage,
}: {
  page: number;
  pages: number;
  onPage: (p: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Pagination">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <span className="px-2 text-sm text-ink-500">
        Page {page} of {pages}
      </span>
      <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </nav>
  );
}
