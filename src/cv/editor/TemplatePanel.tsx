import { ArrowLeft } from 'lucide-react';
import { CV_TEMPLATE_LABELS, CV_TEMPLATES, type CvTemplate } from '../../../shared/constants';
import { CvThumb } from '../../components/CvThumb';
import { cx } from '../../components/ui';
import { ACCENTS } from '../templates';
import { ScaledPage, type Cv } from './parts';

/** Full-screen template and accent-colour picker with a live preview. */
export function TemplatePanel({
  cv,
  onClose,
  onPick,
  onAccent,
  onAcademicOrder,
}: {
  cv: Cv;
  onClose: () => void;
  onPick: (t: CvTemplate) => void;
  onAccent: (a: string) => void;
  onAcademicOrder: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink-600 lg:flex-row">
      <div className="flex max-h-[45vh] flex-col bg-ink lg:max-h-none lg:w-[420px]">
        <div className="flex items-center justify-between px-6 py-4 text-white">
          <h2 className="text-lg font-bold">Templates</h2>
          <button
            onClick={onClose}
            className="flex items-center gap-1 rounded px-2 py-1 text-sm font-semibold hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" /> Back to editor
          </button>
        </div>
        <div className="flex items-center gap-2 px-6 pb-3">
          {ACCENTS.map((a) => (
            <button
              key={a}
              onClick={() => onAccent(a)}
              className={cx(
                'h-7 w-7 rounded-full ring-offset-2 ring-offset-ink',
                cv.data.accent === a && 'ring-2 ring-white',
              )}
              style={{ background: a }}
              aria-label={`Accent colour ${a}`}
              aria-pressed={cv.data.accent === a}
            />
          ))}
        </div>
        <div className="grid flex-1 grid-cols-3 gap-4 overflow-y-auto px-6 pb-6 lg:grid-cols-2">
          {CV_TEMPLATES.map((t) => (
            <button key={t} onClick={() => onPick(t)} className="text-left">
              <div
                className={cx(
                  'overflow-hidden rounded ring-4 transition',
                  cv.template === t ? 'ring-brand-500' : 'ring-transparent hover:ring-brand-300',
                )}
              >
                <CvThumb data={cv.data} template={t} />
              </div>
              <p className="mt-2 text-sm font-semibold text-white">{CV_TEMPLATE_LABELS[t].name}</p>
              <p className="hidden text-xs text-ink-300 lg:block">{CV_TEMPLATE_LABELS[t].blurb}</p>
            </button>
          ))}
        </div>
        {cv.template === 'academic' && (
          <div className="px-6 pb-6">
            <button
              onClick={onAcademicOrder}
              className="w-full rounded bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20"
            >
              Use academic section order (education & publications first)
            </button>
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-6 lg:p-10">
        <div className="mx-auto max-w-[640px]">
          <ScaledPage data={cv.data} template={cv.template} />
        </div>
      </div>
    </div>
  );
}
