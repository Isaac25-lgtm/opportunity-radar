import { Pause, Play, Plus } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { cx } from './ui';

export type HeroSlide = { src: string; caption: string };

const SLIDE_MS = 6500;

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Full-bleed, darkened photo backdrop that cross-fades between slides, with a caption pill,
 * slide dots and a pause button. Photos are decorative; the controls are keyboard accessible.
 * Auto-play is off when the visitor prefers reduced motion.
 */
export function HeroSlideshow({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());

  useEffect(() => {
    if (!playing || slides.length < 2) return;
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [playing, index, slides.length]);

  return (
    <>
      <div className="absolute inset-0" aria-hidden>
        {slides.map((s, i) => (
          <img
            key={s.src}
            src={s.src}
            alt=""
            decoding="async"
            loading={i === 0 ? 'eager' : 'lazy'}
            className={cx(
              'absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-[1400ms] ease-out',
              i === index ? 'scale-100 opacity-100' : 'scale-[1.04] opacity-0',
            )}
          />
        ))}
        {/* Darken for legible text: strongest on the left where the copy sits, and towards the bottom. */}
        <div className="absolute inset-0 bg-gradient-to-r from-night/95 via-night/75 to-night/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-night via-night/20 to-night/50" />
      </div>
      <div className="container-page relative">
        <div className="absolute right-4 top-5 z-10 flex items-center gap-3 sm:right-6 lg:right-8">
          <span className="hidden rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[12.5px] text-white/85 backdrop-blur sm:inline">
            {index + 1} · {slides[index].caption}
          </span>
          <div className="flex items-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.src}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show photo ${i + 1}: ${s.caption}`}
                aria-current={i === index}
                className={cx(
                  'h-1.5 rounded-full transition-all',
                  i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70',
                )}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? 'Pause background photos' : 'Play background photos'}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-white/25 text-white/85 hover:border-white/60"
          >
            {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </button>
        </div>
      </div>
    </>
  );
}

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
