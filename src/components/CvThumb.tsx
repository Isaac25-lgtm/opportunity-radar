import { useEffect, useRef, useState } from 'react';
import type { CvData } from '../../shared/cv';
import type { CvTemplate } from '../../shared/constants';
import { CvDocument } from '../cv/templates';
import { cx } from './ui';

const A4_W = 794;
const A4_H = 1123;

/**
 * Renders an A4 CV scaled to the width of its container. The height follows the real document
 * height (so multi-page CVs are fully visible) unless capped with maxHeight. Page breaks are marked.
 */
export function CvThumb({
  data,
  template,
  className,
  maxHeight,
  pageMarks,
}: {
  data: CvData;
  template: CvTemplate;
  className?: string;
  maxHeight?: number;
  pageMarks?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  const [contentH, setContentH] = useState(A4_H);
  useEffect(() => {
    const el = ref.current;
    const doc = inner.current;
    if (!el || !doc) return;
    const update = () => {
      setScale(el.clientWidth / A4_W);
      setContentH(Math.max(A4_H, doc.scrollHeight));
    };
    const ro = new ResizeObserver(update);
    ro.observe(el);
    ro.observe(doc);
    update();
    return () => ro.disconnect();
  }, []);
  const fullH = contentH * scale;
  const h = Math.min(fullH, maxHeight ?? Infinity);
  const pages = Math.ceil(contentH / A4_H);
  return (
    <div
      ref={ref}
      className={cx('relative w-full min-w-0 overflow-hidden bg-white', className)}
      style={{ height: h }}
      aria-hidden
    >
      <div
        ref={inner}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: A4_W,
          pointerEvents: 'none',
        }}
      >
        <CvDocument data={data} template={template} />
      </div>
      {pageMarks &&
        Array.from({ length: pages - 1 }, (_, i) => (
          <div
            key={i}
            className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-ink-300"
            style={{ top: (i + 1) * A4_H * scale }}
          >
            <span className="absolute right-2 top-1 rounded bg-ink-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              Page {i + 2}
            </span>
          </div>
        ))}
    </div>
  );
}
