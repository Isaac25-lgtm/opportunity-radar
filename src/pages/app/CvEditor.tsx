import { SECTION_TIPS, SectionEditor } from '../../cv/editor/SectionEditor';
import { ArrowLeft, Check, Download, Eye, LayoutGrid, Loader2, Pencil, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  CV_SECTION_LABELS,
  careerFieldsFromCv,
  cvCompleteness,
  type CvData,
  type CvSectionKey,
} from '../../../shared/cv';
import { Button, ErrorAlert, Spinner, TextInput, cx, useToast } from '../../components/ui';
import { ACADEMIC_ORDER } from '../../cv/templates';
import { HistoryModal } from '../../cv/editor/HistoryModal';
import { PreviewPane } from '../../cv/editor/PreviewPane';
import { ScaledPage, SectionShell, type Cv } from '../../cv/editor/parts';
import { TailorPanel } from '../../cv/editor/TailorPanel';
import { TemplatePanel } from '../../cv/editor/TemplatePanel';
import { Toolbar } from '../../cv/editor/Toolbar';
import { cvToDocx } from '../../cv/exporters';
import { api } from '../../lib/api';
import { downloadBlob } from '../../lib/format';

/** Full-screen CV editor (form on the left, live A4 preview on the right). */
export default function CvEditor() {
  const { id } = useParams();
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const [cv, setCv] = useState<Cv | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'dirty' | 'error'>('saved');
  const [panel, setPanel] = useState<null | 'templates' | 'history' | 'tailor' | 'preview'>(
    sp.get('tailor') ? 'tailor' : null,
  );
  const [editingTitle, setEditingTitle] = useState(false);
  const [exporting, setExporting] = useState<null | 'pdf' | 'docx'>(null);
  const [menu, setMenu] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef<Cv | null>(null);

  useEffect(() => {
    api
      .get<{ cv: Cv }>(`/cvs/${id}`)
      .then((r) => {
        setCv(r.cv);
        latest.current = r.cv;
      })
      .catch(setErr);
  }, [id]);

  const persist = useCallback(async (snapshot = false, note?: string) => {
    const c = latest.current;
    if (!c) return;
    setSaveState('saving');
    try {
      await api.put(`/cvs/${c.id}`, { title: c.title, template: c.template, data: c.data, snapshot, note });
      setSaveState('saved');
    } catch (e) {
      setSaveState('error');
      setErr(e);
    }
  }, []);

  const update = useCallback(
    (fn: (c: Cv) => Cv) => {
      setCv((prev) => {
        if (!prev) return prev;
        const next = fn(prev);
        latest.current = next;
        return next;
      });
      setSaveState('dirty');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void persist(), 1200);
    },
    [persist],
  );
  const setData = (fn: (d: CvData) => CvData) => update((c) => ({ ...c, data: fn(c.data) }));

  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => {
      if (saveState === 'dirty' || saveState === 'saving') e.preventDefault();
    };
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, [saveState]);

  const comp = useMemo(() => (cv ? cvCompleteness(cv.data) : { score: 0, warnings: [] }), [cv]);

  if (err && !cv)
    return (
      <div className="p-6">
        <ErrorAlert error={err} />
      </div>
    );
  if (!cv) return <Spinner className="min-h-screen" />;
  const d = cv.data;
  const p = d.personal;
  const setP = (k: keyof CvData['personal'], v: string) =>
    setData((x) => ({ ...x, personal: { ...x.personal, [k]: v } }));
  const toggleHidden = (k: CvSectionKey) =>
    setData((x) => ({
      ...x,
      hidden: x.hidden.includes(k) ? x.hidden.filter((h) => h !== k) : [...x.hidden, k],
    }));
  const moveSection = (k: CvSectionKey, dir: -1 | 1) =>
    setData((x) => {
      const o = [...x.order];
      const i = o.indexOf(k);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= o.length) return x;
      [o[i], o[j]] = [o[j], o[i]];
      return { ...x, order: o };
    });

  const exportAs = async (format: 'pdf' | 'docx') => {
    setMenu(false);
    setExporting(format);
    setErr(null);
    try {
      clearTimeout(timer.current);
      await persist();
      await api.post(`/cvs/${cv.id}/export`, { format });
      if (format === 'pdf') window.open(`/app/cvs/${cv.id}/print`, '_blank', 'noopener');
      else
        downloadBlob(
          await cvToDocx(cv.data),
          `${(p.fullName || cv.title).replace(/[^\w\- ]+/g, '').trim() || 'CV'}.docx`,
        );
    } catch (e) {
      setErr(e);
    } finally {
      setExporting(null);
    }
  };

  const nextTip = comp.warnings.find((w) => w.level !== 'tip') ?? comp.warnings[0];

  return (
    <div className="flex h-screen flex-col bg-white lg:flex-row">
      {/* LEFT: form */}
      <div className="flex min-h-0 flex-1 flex-col lg:w-1/2 lg:flex-none">
        <div className="flex items-center gap-3 border-b border-ink-100 px-4 py-3 sm:px-10">
          <Link
            to="/app/cvs"
            className="rounded p-1.5 text-ink-500 hover:bg-ink-100"
            aria-label="Back to CVs"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex min-w-0 flex-1 justify-center">
            {editingTitle ? (
              <input
                autoFocus
                value={cv.title}
                onChange={(e) => update((c) => ({ ...c, title: e.target.value.slice(0, 150) }))}
                onBlur={() => setEditingTitle(false)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingTitle(false)}
                className="w-full max-w-sm border-b-2 border-brand-500 bg-transparent text-center text-lg font-bold outline-none"
                aria-label="CV title"
              />
            ) : (
              <button
                onClick={() => setEditingTitle(true)}
                className="group flex min-w-0 items-center gap-2 text-lg font-bold"
              >
                <span className="truncate">{cv.title}</span>
                <Pencil className="h-4 w-4 flex-none text-ink-300 group-hover:text-brand-500" />
              </button>
            )}
          </div>
          <span className="flex w-20 items-center justify-end gap-1 text-xs text-ink-400" aria-live="polite">
            {saveState === 'saving' ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving
              </>
            ) : saveState === 'saved' ? (
              <>
                <Check className="h-3.5 w-3.5 text-ok-500" /> Saved
              </>
            ) : saveState === 'error' ? (
              <span className="text-bad-700">Not saved</span>
            ) : (
              'Editing'
            )}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 sm:px-10 lg:pb-10">
          {/* Completeness */}
          <div className="pt-6">
            <div className="flex items-center gap-3 text-sm">
              <span
                className={cx(
                  'rounded px-1.5 py-0.5 text-xs font-bold text-white',
                  comp.score >= 80 ? 'bg-ok-500' : comp.score >= 50 ? 'bg-brand-500' : 'bg-warn-500',
                )}
              >
                {comp.score}%
              </span>
              <span className="text-ink-500">CV completeness</span>
              {nextTip && (
                <span className="ml-auto hidden truncate text-xs text-ink-400 sm:inline">
                  Next: {nextTip.message}
                </span>
              )}
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-100">
              <div
                className={cx(
                  'h-full transition-all',
                  comp.score >= 80 ? 'bg-ok-500' : comp.score >= 50 ? 'bg-brand-500' : 'bg-warn-500',
                )}
                style={{ width: `${comp.score}%` }}
              />
            </div>
            {comp.warnings.filter((w) => w.level !== 'tip').length > 0 && (
              <details className="mt-3 rounded bg-warn-50 px-4 py-2 text-sm text-warn-700">
                <summary className="cursor-pointer font-semibold">
                  {comp.warnings.filter((w) => w.level !== 'tip').length} item(s) need attention
                </summary>
                <ul className="mt-2 list-disc space-y-0.5 pl-5">
                  {comp.warnings.map((w, i) => (
                    <li key={i} className={w.level === 'tip' ? 'text-ink-500' : ''}>
                      {w.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <ErrorAlert error={err} className="mt-3" />
          </div>

          {/* Personal details */}
          <SectionShell k="personal" title="Personal details">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextInput
                label="Wanted job title"
                placeholder="e.g. Accountant"
                value={p.headline}
                onChange={(e) => setP('headline', e.target.value)}
                className="sm:col-span-2"
              />
              <TextInput
                label="Full name"
                value={p.fullName}
                onChange={(e) => setP('fullName', e.target.value)}
              />
              <TextInput
                label="Email"
                type="email"
                value={p.email}
                onChange={(e) => setP('email', e.target.value)}
              />
              <TextInput label="Phone" value={p.phone} onChange={(e) => setP('phone', e.target.value)} />
              <TextInput
                label="City, country"
                value={p.location}
                onChange={(e) => setP('location', e.target.value)}
              />
              <TextInput
                label="LinkedIn"
                value={p.linkedin}
                onChange={(e) => setP('linkedin', e.target.value)}
              />
              <TextInput
                label="Website / portfolio"
                value={p.website}
                onChange={(e) => setP('website', e.target.value)}
              />
            </div>
          </SectionShell>

          {d.order.map((k) => (
            <SectionShell
              key={k}
              k={k}
              title={CV_SECTION_LABELS[k]}
              hidden={d.hidden.includes(k)}
              onToggle={() => toggleHidden(k)}
              onMove={(dir) => moveSection(k, dir)}
              tip={SECTION_TIPS[k]}
            >
              <SectionEditor section={k} data={d} onChange={setData} />
            </SectionShell>
          ))}

          <div className="py-8 text-sm text-ink-500">
            <p className="font-semibold text-ink">Factual integrity</p>
            <p className="mt-1">
              Everything on your CV must be true. Opportunity Radar never adds employers, dates,
              qualifications, skills or results you did not write.
            </p>
            <button
              className="mt-3 font-semibold text-brand-600 hover:underline"
              onClick={async () => {
                const prof = await api.get('/profiles/career');
                const merged = {
                  ...(prof.profile?.data ?? {}),
                  ...Object.fromEntries(
                    Object.entries(careerFieldsFromCv(d)).filter(([, v]) =>
                      Array.isArray(v) ? v.length : v,
                    ),
                  ),
                };
                try {
                  await api.put('/profiles/career', { data: merged });
                  toast('Career profile updated from this CV');
                } catch (e) {
                  setErr(e);
                }
              }}
            >
              Update my career profile from this CV
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT: preview */}
      <div className="relative hidden min-h-0 flex-1 flex-col bg-ink-500 lg:flex">
        <div className="min-h-0 flex-1">
          <PreviewPane data={d} template={cv.template} />
        </div>
        <Toolbar
          onTemplates={() => setPanel('templates')}
          onHistory={() => setPanel('history')}
          onTailor={() => setPanel('tailor')}
          onExport={exportAs}
          exporting={exporting}
          menu={menu}
          setMenu={setMenu}
        />
      </div>

      {/* Mobile bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-ink-200 bg-white px-4 py-3 lg:hidden">
        <Button variant="secondary" className="flex-1" onClick={() => setPanel('preview')}>
          <Eye className="h-4 w-4" /> Preview
        </Button>
        <Button variant="outline" onClick={() => setPanel('templates')} aria-label="Templates">
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Button className="flex-1" loading={exporting === 'pdf'} onClick={() => exportAs('pdf')}>
          <Download className="h-4 w-4" /> PDF
        </Button>
      </div>

      {panel === 'preview' && (
        <div className="fixed inset-0 z-40 flex flex-col bg-ink-500 lg:hidden">
          <div className="flex items-center justify-between bg-ink px-4 py-3 text-white">
            <span className="font-semibold">Preview</span>
            <button onClick={() => setPanel(null)} aria-label="Close preview">
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <ScaledPage data={d} template={cv.template} />
          </div>
          <Toolbar
            onTemplates={() => setPanel('templates')}
            onHistory={() => setPanel('history')}
            onTailor={() => setPanel('tailor')}
            onExport={exportAs}
            exporting={exporting}
            menu={menu}
            setMenu={setMenu}
          />
        </div>
      )}

      {panel === 'templates' && (
        <TemplatePanel
          cv={cv}
          onClose={() => setPanel(null)}
          onPick={(t) => update((c) => ({ ...c, template: t }))}
          onAccent={(a) => setData((x) => ({ ...x, accent: a }))}
          onAcademicOrder={() => setData((x) => ({ ...x, order: ACADEMIC_ORDER }))}
        />
      )}
      {panel === 'history' && (
        <HistoryModal
          cvId={cv.id}
          onClose={() => setPanel(null)}
          onSnapshot={() => persist(true, 'Saved version')}
          onRestored={async () => {
            const r = await api.get<{ cv: Cv }>(`/cvs/${cv.id}`);
            setCv(r.cv);
            latest.current = r.cv;
            setPanel(null);
            toast('Version restored');
          }}
        />
      )}
      {panel === 'tailor' && (
        <TailorPanel
          cvId={cv.id}
          initialOpp={sp.get('tailor')}
          onClose={() => {
            setPanel(null);
            if (sp.get('tailor')) {
              sp.delete('tailor');
              setSp(sp, { replace: true });
            }
          }}
          onCopy={(newId) => nav(`/app/cvs/${newId}/edit`)}
        />
      )}
    </div>
  );
}
