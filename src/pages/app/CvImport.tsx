import { CheckCircle2, FileUp, ShieldCheck } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MAX_UPLOAD_BYTES } from '../../../shared/constants';
import { careerFieldsFromCv, dateRange, type CvData } from '../../../shared/cv';
import {
  Alert,
  Button,
  ErrorAlert,
  PageHeader,
  Spinner,
  TextArea,
  TextInput,
  cx,
  useToast,
} from '../../components/ui';
import { Items, LevelItems } from '../../cv/editor/fields';
import { extractText } from '../../cv/exporters';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

type Parsed = { data: CvData; found: string[]; unassigned: string[]; method: string };

export default function CvImport() {
  const nav = useNavigate();
  const toast = useToast();
  const { refresh } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<'pick' | 'reading' | 'review'>('pick');
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [keepCopy, setKeepCopy] = useState(true);
  const [toCv, setToCv] = useState(true);
  const [toProfile, setToProfile] = useState(true);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  const handle = async (f: File) => {
    setErr(null);
    if (f.size > MAX_UPLOAD_BYTES) return setErr(new Error('Files must be 5 MB or smaller.'));
    if (!/\.(pdf|docx)$/i.test(f.name)) return setErr(new Error('Please choose a PDF or Word (.docx) file.'));
    setFile(f);
    setStage('reading');
    try {
      const text = await extractText(f);
      if (text.replace(/\s/g, '').length < 30)
        throw new Error(
          'We could not find text in this file. If it is a scanned image, please build your CV manually instead.',
        );
      const r = await api.post<Parsed>('/cvs/parse', { text });
      setParsed(r);
      setStage('review');
    } catch (e) {
      setErr(e);
      setStage('pick');
    }
  };

  const setData = (fn: (d: CvData) => CvData) => setParsed((p) => p && { ...p, data: fn(p.data) });

  const confirm = async () => {
    if (!parsed) return;
    setBusy(true);
    setErr(null);
    try {
      if (keepCopy && file) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('kind', 'cv');
        await api.upload('/documents', fd).catch((e) => toast(`Original not stored: ${e.message}`, 'bad'));
      }
      if (toProfile) {
        const cur = await api.get('/profiles/career');
        const fields = careerFieldsFromCv(parsed.data);
        const merged = { ...(cur.profile?.data ?? {}) };
        for (const [k, v] of Object.entries(fields))
          if (Array.isArray(v) ? v.length : v) (merged as any)[k] = v;
        await api.put('/profiles/career', { data: merged });
      }
      let id: string | null = null;
      if (toCv)
        id = (
          await api.post('/cvs', {
            title: parsed.data.personal.fullName ? `${parsed.data.personal.fullName} — CV` : 'Imported CV',
            from: 'data',
            data: parsed.data,
          })
        ).id;
      await refresh();
      toast('Import complete');
      nav(id ? `/app/cvs/${id}/edit` : '/app/profiles/career');
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  if (stage === 'reading')
    return <Spinner label="Reading your CV in the browser…" className="min-h-[40vh]" />;

  if (stage === 'pick' || !parsed)
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader
          title="Upload your CV"
          subtitle="We read your PDF or Word CV and split it into sections for you to check."
        />
        <ErrorAlert error={err} className="mb-4" />
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files[0];
            if (f) void handle(f);
          }}
          className={cx(
            'flex flex-col items-center rounded-xl border-2 border-dashed bg-white px-6 py-14 text-center',
            drag ? 'border-brand-500 bg-brand-50' : 'border-ink-300',
          )}
        >
          <FileUp className="h-12 w-12 text-brand-500" />
          <p className="mt-4 text-lg font-bold">Drag and drop your CV here</p>
          <p className="text-sm text-ink-500">PDF or DOCX, up to 5 MB</p>
          <Button className="mt-5" onClick={() => input.current?.click()}>
            Choose file
          </Button>
          <input
            ref={input}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && void handle(e.target.files[0])}
          />
        </div>
        <div className="mt-6 flex gap-3 text-sm text-ink-600">
          <ShieldCheck className="h-5 w-5 flex-none text-ok-500" />
          <p>
            Text extraction happens on your device. Only the extracted text is sent to our server to identify
            sections. Nothing is saved to your profile until you confirm on the next step.
          </p>
        </div>
        <p className="mt-6 text-sm">
          Prefer to type?{' '}
          <Link to="/app/cvs" className="link">
            Build a CV from scratch
          </Link>
        </p>
      </div>
    );

  const d = parsed.data;
  const p = d.personal;
  return (
    <div className="mx-auto max-w-3xl pb-28">
      <PageHeader
        title="Check what we found"
        subtitle={`From ${file?.name}. Correct anything that looks wrong — we only copied text that is in your file.`}
      />
      <Alert
        tone="info"
        className="mb-6"
        title={`Found: ${parsed.found.length ? parsed.found.join(', ') : 'very little'}`}
      >
        Sections we could not recognise are not added. You can add or edit anything here or later in the
        editor.
      </Alert>
      <ErrorAlert error={err} className="mb-4" />
      <div className="card space-y-8 p-5 sm:p-7">
        <section>
          <h2 className="mb-3 text-lg font-bold">Personal details</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(
              [
                ['fullName', 'Full name'],
                ['headline', 'Headline / job title'],
                ['email', 'Email'],
                ['phone', 'Phone'],
                ['location', 'Location'],
                ['linkedin', 'LinkedIn'],
              ] as const
            ).map(([k, l]) => (
              <TextInput
                key={k}
                label={l}
                value={p[k]}
                onChange={(e) => setData((x) => ({ ...x, personal: { ...x.personal, [k]: e.target.value } }))}
              />
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-bold">Summary</h2>
          <TextArea value={d.summary} onChange={(e) => setData((x) => ({ ...x, summary: e.target.value }))} />
        </section>
        <section>
          <h2 className="mb-3 text-lg font-bold">Employment history ({d.experience.length})</h2>
          <Items
            items={d.experience}
            onChange={(v) => setData((x) => ({ ...x, experience: v }))}
            title={(e) => [e.title, e.employer].filter(Boolean).join(' at ')}
            subtitle={(e) => dateRange(e.start, e.end, e.current) || 'Dates not found — please add'}
            blank={() => ({
              id: Math.random().toString(36).slice(2),
              title: '',
              employer: '',
              location: '',
              start: '',
              end: '',
              current: false,
              description: '',
            })}
            addLabel="Add employment"
            fields={[
              { key: 'title', label: 'Job title' },
              { key: 'employer', label: 'Employer' },
              { key: 'start', label: 'Start', type: 'month' },
              { key: 'end', label: 'End', type: 'month' },
              { key: 'current', label: 'Current role', type: 'checkbox' },
              { key: 'description', label: 'Description', type: 'textarea' },
            ]}
          />
        </section>
        <section>
          <h2 className="mb-3 text-lg font-bold">Education ({d.education.length})</h2>
          <Items
            items={d.education}
            onChange={(v) => setData((x) => ({ ...x, education: v }))}
            title={(e) => [e.degree, e.institution].filter(Boolean).join(', ')}
            subtitle={(e) => dateRange(e.start, e.end)}
            blank={() => ({
              id: Math.random().toString(36).slice(2),
              degree: '',
              institution: '',
              location: '',
              start: '',
              end: '',
              grade: '',
              details: '',
            })}
            addLabel="Add education"
            fields={[
              { key: 'degree', label: 'Qualification' },
              { key: 'institution', label: 'Institution' },
              { key: 'start', label: 'Start', type: 'month' },
              { key: 'end', label: 'End', type: 'month' },
              { key: 'grade', label: 'Grade' },
            ]}
          />
        </section>
        <section>
          <h2 className="mb-3 text-lg font-bold">Skills ({d.skills.length})</h2>
          <LevelItems
            items={d.skills}
            onChange={(v) => setData((x) => ({ ...x, skills: v }))}
            levels={['Beginner', 'Skilful', 'Experienced', 'Expert']}
            placeholder="Add skills, separated by commas"
            addLabel="Add skill"
          />
        </section>
        <section>
          <h2 className="mb-3 text-lg font-bold">Languages ({d.languages.length})</h2>
          <LevelItems
            items={d.languages}
            onChange={(v) => setData((x) => ({ ...x, languages: v }))}
            levels={['Native', 'Fluent', 'Professional', 'Conversational', 'Basic']}
            placeholder="e.g. English"
            addLabel="Add language"
          />
        </section>
        {(d.certifications.length > 0 ||
          d.projects.length > 0 ||
          d.publications.length > 0 ||
          d.awards.length > 0) && (
          <p className="text-sm text-ink-600">
            Also found:{' '}
            {[
              d.certifications.length && `${d.certifications.length} certification(s)`,
              d.projects.length && `${d.projects.length} project(s)`,
              d.publications.length && `${d.publications.length} publication(s)`,
              d.awards.length && `${d.awards.length} award(s)`,
            ]
              .filter(Boolean)
              .join(', ')}{' '}
            — editable in the CV editor.
          </p>
        )}
        {parsed.unassigned.length > 0 && (
          <details className="rounded bg-ink-50 p-4 text-sm">
            <summary className="cursor-pointer font-semibold">
              Lines we could not place ({parsed.unassigned.length})
            </summary>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-ink-600">
              {parsed.unassigned.join('\n')}
            </pre>
          </details>
        )}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white">
        <div className="container-page flex max-w-3xl flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {(
              [
                [toCv, setToCv, 'Create a CV'],
                [toProfile, setToProfile, 'Update my career profile'],
                [keepCopy, setKeepCopy, 'Keep the original file privately'],
              ] as const
            ).map(([v, s, l]) => (
              <label key={l} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-ink-300"
                  checked={v}
                  onChange={(e) => s(e.target.checked)}
                />{' '}
                {l}
              </label>
            ))}
          </div>
          <Button loading={busy} disabled={!toCv && !toProfile} onClick={confirm}>
            <CheckCircle2 className="h-4 w-4" /> Confirm and save
          </Button>
        </div>
      </div>
    </div>
  );
}
