import { Copy, FileText, FileUp, Mail, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CV_TEMPLATE_LABELS, CV_TEMPLATES, type CvTemplate } from '../../../shared/constants';
import { formatLimit } from '../../../shared/entitlements';
import { CvThumb } from '../../components/CvThumb';
import {
  Button,
  EmptyState,
  ErrorAlert,
  Modal,
  PageHeader,
  Spinner,
  Tabs,
  TextInput,
  cx,
  useConfirm,
  useLoad,
  useToast,
} from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { relTime } from '../../lib/format';
import { SAMPLE_CV } from '../../cv/sample';

export default function CvList() {
  const { me } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [tab, setTab] = useState<'cvs' | 'letters'>('cvs');
  const cvs = useLoad(() => api.get<{ cvs: any[] }>('/cvs'), []);
  const letters = useLoad(() => api.get<{ letters: any[] }>('/cover-letters'), []);
  const [create, setCreate] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const limit = me.plan?.entitlements.max_cvs ?? 1;
  return (
    <>
      {dialog}
      <PageHeader
        title="CVs & cover letters"
        subtitle={`Your plan allows ${formatLimit(limit)} CV${limit === 1 ? '' : 's'}.`}
        actions={
          <>
            <Link to="/app/cvs/import" className="btn btn-md btn-secondary">
              <FileUp className="h-4 w-4" /> Upload CV
            </Link>
            <Button onClick={() => setCreate(true)}>
              <Plus className="h-4 w-4" /> Create new
            </Button>
          </>
        }
      />
      <Tabs
        className="mb-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'cvs', label: 'CVs' },
          { value: 'letters', label: 'Cover letters' },
        ]}
      />
      <ErrorAlert error={err} className="mb-4" />
      {tab === 'cvs' &&
        (cvs.loading ? (
          <Spinner />
        ) : cvs.data?.cvs.length ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {cvs.data.cvs.map((c) => (
              <div key={c.id} className="group relative">
                <Link
                  to={`/app/cvs/${c.id}/edit`}
                  className="block overflow-hidden rounded-lg bg-white shadow-card ring-1 ring-ink-100 transition hover:shadow-paper"
                >
                  <CvThumb data={c.data} template={c.template} maxHeight={360} />
                </Link>
                <div className="mt-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      to={`/app/cvs/${c.id}/edit`}
                      className="block truncate font-bold hover:text-brand-600"
                    >
                      {c.title}
                    </Link>
                    <p className="text-xs text-ink-500">
                      {CV_TEMPLATE_LABELS[c.template as CvTemplate]?.name} · updated {relTime(c.updated_at)}
                      {c.target_opportunity_id && ' · tailored'}
                    </p>
                  </div>
                  <div className="relative">
                    <button
                      className="rounded p-1.5 text-ink-400 hover:bg-ink-100"
                      onClick={() => setMenu(menu === c.id ? null : c.id)}
                      aria-label="CV actions"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>
                    {menu === c.id && (
                      <div className="absolute right-0 z-10 mt-1 w-44 rounded-lg bg-white py-1 shadow-paper ring-1 ring-ink-100">
                        <Link
                          to={`/app/cvs/${c.id}/edit`}
                          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-ink-50"
                        >
                          <Pencil className="h-4 w-4" /> Edit
                        </Link>
                        <button
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-ink-50"
                          onClick={async () => {
                            setMenu(null);
                            try {
                              const r = await api.post(`/cvs/${c.id}/duplicate`);
                              nav(`/app/cvs/${r.id}/edit`);
                            } catch (e) {
                              setErr(e);
                            }
                          }}
                        >
                          <Copy className="h-4 w-4" /> Duplicate
                        </button>
                        <button
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-bad-700 hover:bg-bad-50"
                          onClick={async () => {
                            setMenu(null);
                            if (
                              !(await confirm(
                                'Delete this CV?',
                                `“${c.title}” and its version history will be deleted.`,
                                { confirm: 'Delete', danger: true },
                              ))
                            )
                              return;
                            await api.del(`/cvs/${c.id}`);
                            cvs.reload();
                            toast('CV deleted', 'info');
                          }}
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <button
              onClick={() => setCreate(true)}
              className="flex min-h-[300px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-ink-200 text-ink-500 hover:border-brand-400 hover:text-brand-600"
            >
              <Plus className="h-8 w-8" />
              <span className="font-semibold">New CV</span>
            </button>
          </div>
        ) : (
          <EmptyState
            icon={<FileText className="h-10 w-10" />}
            title="Create your first CV"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setCreate(true)}>Start building</Button>
                <Link to="/app/cvs/import" className="btn btn-md btn-secondary">
                  Upload existing CV
                </Link>
              </div>
            }
          >
            Build from scratch, from your career profile, or by importing your current CV.
          </EmptyState>
        ))}
      {tab === 'letters' &&
        (letters.loading ? (
          <Spinner />
        ) : letters.data?.letters.length ? (
          <ul className="card divide-y divide-ink-100">
            {letters.data.letters.map((l) => (
              <li key={l.id}>
                <Link
                  to={`/app/cover-letters/${l.id}`}
                  className="flex items-center gap-3 px-5 py-4 hover:bg-ink-50"
                >
                  <Mail className="h-5 w-5 text-brand-500" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{l.title}</p>
                    <p className="text-xs text-ink-500">Updated {relTime(l.updated_at)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Mail className="h-10 w-10" />} title="No cover letters yet">
            Open a CV, choose <strong>Tailor</strong> and pick an opportunity to draft a cover letter from
            your own CV facts.
          </EmptyState>
        ))}
      {create && (
        <CreateModal
          hasProfile={!!me.profiles?.some((p) => p.type === 'career')}
          onClose={() => setCreate(false)}
          onError={setErr}
        />
      )}
    </>
  );
}

function CreateModal({
  hasProfile,
  onClose,
  onError,
}: {
  hasProfile: boolean;
  onClose: () => void;
  onError: (e: unknown) => void;
}) {
  const nav = useNavigate();
  const [title, setTitle] = useState('My CV');
  const [template, setTemplate] = useState<CvTemplate>('modern');
  const [from, setFrom] = useState<'blank' | 'profile'>(hasProfile ? 'profile' : 'blank');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Create a new CV"
      footer={
        <Button
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await api.post('/cvs', { title, template, from });
              nav(`/app/cvs/${r.id}/edit`);
            } catch (e) {
              setErr(e);
              onError(null);
              setBusy(false);
            }
          }}
        >
          Create CV
        </Button>
      }
    >
      <ErrorAlert error={err} className="mb-4" />
      <TextInput
        label="CV name"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        hint="Only you see this — e.g. “NGO M&E roles”."
      />
      <p className="field-label mt-5">Start from</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(
          [
            [
              'profile',
              'My career profile',
              hasProfile ? 'Pre-fills experience, education and skills.' : 'Create a career profile first.',
            ],
            ['blank', 'A blank CV', 'Start with only your name and email.'],
          ] as const
        ).map(([v, l, d]) => (
          <button
            key={v}
            disabled={v === 'profile' && !hasProfile}
            onClick={() => setFrom(v)}
            className={cx(
              'rounded-lg border-2 p-3 text-left disabled:opacity-50',
              from === v ? 'border-brand-500 bg-brand-50' : 'border-ink-200',
            )}
          >
            <p className="font-semibold">{l}</p>
            <p className="text-xs text-ink-500">{d}</p>
          </button>
        ))}
      </div>
      <p className="field-label mt-5">Template</p>
      <div className="grid grid-cols-3 gap-3">
        {CV_TEMPLATES.map((t) => (
          <button key={t} onClick={() => setTemplate(t)} className="text-left">
            <div
              className={cx(
                'overflow-hidden rounded ring-2',
                template === t ? 'ring-brand-500' : 'ring-ink-100',
              )}
            >
              <CvThumb data={SAMPLE_CV} template={t} maxHeight={180} />
            </div>
            <p className="mt-1 text-sm font-semibold">{CV_TEMPLATE_LABELS[t].name}</p>
          </button>
        ))}
      </div>
    </Modal>
  );
}
