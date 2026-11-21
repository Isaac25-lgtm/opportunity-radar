import { Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cx } from './ui';

/** Section title block used on marketing pages. */
export function SectionHeading({
  eyebrow,
  title,
  sub,
  center,
  light,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  sub?: ReactNode;
  center?: boolean;
  light?: boolean;
  className?: string;
}) {
  return (
    <div className={cx(center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl', className)}>
      {eyebrow && <p className={cx('eyebrow', light && '!text-white/60')}>{eyebrow}</p>}
      <h2
        className={cx(
          'mt-2 text-[30px] font-medium leading-[1.12] sm:text-[37px]',
          light ? 'text-white' : 'text-ink',
        )}
      >
        {title}
      </h2>
      {sub && <p className={cx('mt-4 text-[16.5px]', light ? 'text-white/70' : 'text-ink-500')}>{sub}</p>}
    </div>
  );
}

/** Accessible question/answer list; one item open at a time. */
export function Faq({
  items,
  defaultOpen = null,
}: {
  items: Array<[string, ReactNode]>;
  defaultOpen?: number | null;
}) {
  const [open, setOpen] = useState<number | null>(defaultOpen);
  return (
    <div className="divide-y divide-ink-200 border-b border-ink-200">
      {items.map(([q, a], i) => (
        <div key={q}>
          <button
            className="flex w-full items-center justify-between gap-6 py-5 text-left text-[16px] font-medium text-ink"
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
          >
            {q}
            <Plus
              className={cx(
                'h-4 w-4 flex-none text-ink-500 transition-transform duration-200',
                open === i && 'rotate-45',
              )}
              aria-hidden
            />
          </button>
          {open === i && <div className="-mt-1 pb-5 pr-10 text-[15px] leading-relaxed text-ink-600">{a}</div>}
        </div>
      ))}
    </div>
  );
}
