import { ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { type ReactNode } from 'react';
import { type CvTemplate } from '../../../shared/constants';
import { type CvData } from '../../../shared/cv';
import { CvThumb } from '../../components/CvThumb';
import { cx } from '../../components/ui';

/** Building blocks shared by the CV editor screens. */
export type Cv = { id: string; title: string; template: CvTemplate; data: CvData; updated_at: string };

export function ScaledPage({ data, template }: { data: CvData; template: CvTemplate }) {
  // Wraps CvThumb so the paper height follows the document's real height.
  return <CvThumb data={data} template={template} className="rounded-md shadow-paper" pageMarks />;
}

/* ---------------- Section shell (resume.io-like) ---------------- */
export function SectionShell({
  k,
  title,
  hidden,
  onToggle,
  onMove,
  children,
  tip,
}: {
  k: string;
  title: string;
  hidden?: boolean;
  onToggle?: () => void;
  onMove?: (d: -1 | 1) => void;
  children: ReactNode;
  tip?: ReactNode;
}) {
  return (
    <section
      className={cx('group/section border-b border-ink-100 py-7', hidden && 'opacity-60')}
      aria-labelledby={`sec-${k}`}
    >
      <div className="mb-1 flex items-center gap-2">
        <h2 id={`sec-${k}`} className="text-[19px] font-bold text-ink">
          {title}
        </h2>
        <div className="ml-auto flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover/section:opacity-100 sm:focus-within:opacity-100">
          {onMove && (
            <>
              <button
                onClick={() => onMove(-1)}
                className="rounded p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink"
                aria-label={`Move ${title} up`}
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                onClick={() => onMove(1)}
                className="rounded p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink"
                aria-label={`Move ${title} down`}
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </>
          )}
          {onToggle && (
            <button
              onClick={onToggle}
              className="rounded p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink"
              aria-label={hidden ? `Show ${title}` : `Hide ${title}`}
              title={hidden ? 'Hidden from CV' : 'Hide from CV'}
            >
              {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>
      {tip && <p className="mb-4 text-sm text-ink-400">{tip}</p>}
      {children}
    </section>
  );
}

/* ---------------- Main editor ---------------- */
