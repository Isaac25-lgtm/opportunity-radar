import { CalendarClock, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUSES,
  type ApplicationStatus,
} from '../../../shared/constants';
import {
  Button,
  ErrorAlert,
  Modal,
  PageHeader,
  SelectInput,
  Spinner,
  Tabs,
  TextArea,
  TextInput,
  useConfirm,
  useLoad,
  useToast,
} from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { fmtDate } from '../../lib/format';

type App = {
  id: string;
  kind: 'application' | 'bid';
  title: string;
  organization: string;
  status: ApplicationStatus;
  opportunity_id: string | null;
  applied_at: string | null;
  follow_up_at: string | null;
  deadline_at: string | null;
  notes: string;
  cv_id: string | null;
  document_ids: string[];
  profile_id: string | null;
};

const COLUMNS: Array<{ key: string; label: string; statuses: ApplicationStatus[] }> = [
  { key: 'interested', label: 'Interested', statuses: ['interested'] },
  { key: 'preparing', label: 'Preparing', statuses: ['preparing'] },
  { key: 'applied', label: 'Applied / submitted', statuses: ['applied'] },
  { key: 'shortlisted', label: 'Interview / shortlisted', statuses: ['shortlisted'] },
  { key: 'awarded', label: 'Awarded / won', statuses: ['awarded'] },
  { key: 'closed', label: 'Closed', statuses: ['rejected', 'withdrawn', 'closed'] },
];

const dateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

export default function Tracker() {
  const [kind, setKind] = useState<'application' | 'bid'>('application');
  const { data, error, loading, reload } = useLoad(
    () => api.get<{ applications: App[] }>(`/applications?kind=${kind}`),
    [kind],
  );
  const [edit, setEdit] = useState<Partial<App> | null>(null);
  return (
    <>
      <PageHeader
        title="Tracker"
        subtitle="Keep job and scholarship applications separate from business bids. Follow-up dates create reminders."
        actions={
          <Button
            onClick={() =>
              setEdit({
                kind,
                status: 'interested',
                title: '',
                organization: '',
                notes: '',
                document_ids: [],
              })
            }
          >
            <Plus className="h-4 w-4" /> Add {kind === 'bid' ? 'bid' : 'application'}
          </Button>
        }
      />
      <Tabs
        className="mb-6"
        value={kind}
        onChange={setKind}
        tabs={[
          { value: 'application', label: 'Applications' },
          { value: 'bid', label: 'Business bids' },
        ]}
      />
      <ErrorAlert error={error} />
      {loading ? (
        <Spinner />
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-4">
          <div className="grid min-w-[1100px] grid-cols-6 gap-4">
            {COLUMNS.map((col) => {
              const items = (data?.applications ?? []).filter((a) => col.statuses.includes(a.status));
              return (
                <div key={col.key} className="rounded-lg bg-ink-100 p-3">
                  <h2 className="mb-3 flex items-center justify-between text-sm font-bold text-ink-600">
                    {col.label} <span className="rounded-full bg-white px-2 text-xs">{items.length}</span>
                  </h2>
                  <div className="space-y-2">
                    {items.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setEdit(a)}
                        className="w-full rounded-md bg-white p-3 text-left shadow-sm hover:shadow-card"
                      >
                        <p className="line-clamp-2 text-sm font-semibold">{a.title}</p>
                        {a.organization && (
                          <p className="mt-0.5 truncate text-xs text-ink-500">{a.organization}</p>
                        )}
                        {col.key === 'closed' && (
                          <p className="mt-1 text-xs text-ink-400">{APPLICATION_STATUS_LABELS[a.status]}</p>
                        )}
                        {(a.follow_up_at || a.deadline_at) && (
                          <p className="mt-2 flex items-center gap-1 text-xs text-warn-700">
                            <CalendarClock className="h-3.5 w-3.5" />{' '}
                            {a.follow_up_at
                              ? `Follow up ${fmtDate(a.follow_up_at)}`
                              : `Due ${fmtDate(a.deadline_at)}`}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {!loading && !data?.applications.length && (
        <p className="mt-2 text-center text-sm text-ink-500">
          Nothing tracked yet. Use <strong>Track</strong> on any{' '}
          <Link to="/app/opportunities" className="link">
            opportunity
          </Link>{' '}
          or add one manually.
        </p>
      )}
      {edit && (
        <EditModal
          app={edit}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function EditModal({
  app,
  onClose,
  onSaved,
}: {
  app: Partial<App>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [f, setF] = useState<Partial<App>>(app);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const cvs = useLoad(() => api.get<{ cvs: any[] }>('/cvs'), []);
  const docs = useLoad(() => api.get<{ documents: any[] }>('/documents'), []);
  const details = err instanceof ApiError ? (err.details ?? {}) : {};
  const toIso = (v: string) => (v ? new Date(`${v}T12:00:00Z`).toISOString() : null);
  const save = async () => {
    setBusy(true);
    setErr(null);
    const payload = {
      kind: f.kind,
      title: f.title,
      organization: f.organization ?? '',
      status: f.status,
      opportunity_id: f.opportunity_id ?? null,
      profile_id: f.profile_id ?? null,
      applied_at: f.applied_at ?? null,
      follow_up_at: f.follow_up_at ?? null,
      deadline_at: f.deadline_at ?? null,
      notes: f.notes ?? '',
      cv_id: f.cv_id || null,
      document_ids: f.document_ids ?? [],
    };
    try {
      if (f.id) await api.put(`/applications/${f.id}`, payload);
      else await api.post('/applications', payload);
      toast('Saved');
      onSaved();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={f.id ? 'Edit' : `Add ${f.kind === 'bid' ? 'bid' : 'application'}`}
      footer={
        <>
          {f.id && (
            <Button
              variant="ghost"
              className="mr-auto text-bad-700"
              onClick={async () => {
                if (
                  !(await confirm('Remove from tracker?', 'This deletes the tracking record only.', {
                    confirm: 'Remove',
                    danger: true,
                  }))
                )
                  return;
                await api.del(`/applications/${f.id}`);
                onSaved();
              }}
            >
              Remove
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      {dialog}
      <ErrorAlert error={err} className="mb-4" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput
          className="sm:col-span-2"
          label={f.kind === 'bid' ? 'Tender / contract' : 'Position / programme'}
          value={f.title ?? ''}
          onChange={(e) => setF({ ...f, title: e.target.value })}
          error={details.title}
        />
        <TextInput
          label={f.kind === 'bid' ? 'Procuring entity' : 'Organisation'}
          value={f.organization ?? ''}
          onChange={(e) => setF({ ...f, organization: e.target.value })}
        />
        <SelectInput
          label="Status"
          value={f.status}
          onChange={(e) => setF({ ...f, status: e.target.value as ApplicationStatus })}
          options={APPLICATION_STATUSES.map((s) => ({ value: s, label: APPLICATION_STATUS_LABELS[s] }))}
        />
        <TextInput
          label={f.kind === 'bid' ? 'Submitted on' : 'Applied on'}
          type="date"
          value={dateInput(f.applied_at ?? null)}
          onChange={(e) => setF({ ...f, applied_at: toIso(e.target.value) })}
        />
        <TextInput
          label="Follow up on"
          type="date"
          value={dateInput(f.follow_up_at ?? null)}
          onChange={(e) => setF({ ...f, follow_up_at: toIso(e.target.value) })}
          hint="We remind you the day before."
        />
        <TextInput
          label="Deadline"
          type="date"
          value={dateInput(f.deadline_at ?? null)}
          onChange={(e) => setF({ ...f, deadline_at: toIso(e.target.value) })}
        />
        <SelectInput
          label="CV used"
          value={f.cv_id ?? ''}
          onChange={(e) => setF({ ...f, cv_id: e.target.value || null })}
          placeholder="None"
          options={(cvs.data?.cvs ?? []).map((c) => ({ value: c.id, label: c.title }))}
        />
        <div className="sm:col-span-2">
          <p className="field-label">Documents</p>
          <div className="flex flex-wrap gap-2">
            {(docs.data?.documents ?? []).map((d) => {
              const on = f.document_ids?.includes(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() =>
                    setF({
                      ...f,
                      document_ids: on
                        ? f.document_ids!.filter((x) => x !== d.id)
                        : [...(f.document_ids ?? []), d.id],
                    })
                  }
                  className={`rounded-full border px-3 py-1 text-sm ${on ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200'}`}
                  aria-pressed={on}
                >
                  {d.filename}
                </button>
              );
            })}
            {!docs.data?.documents.length && (
              <p className="text-sm text-ink-500">
                No documents yet —{' '}
                <Link to="/app/documents" className="link">
                  upload
                </Link>
              </p>
            )}
          </div>
        </div>
        <TextArea
          className="sm:col-span-2"
          label="Notes"
          value={f.notes ?? ''}
          onChange={(e) => setF({ ...f, notes: e.target.value })}
        />
        {f.opportunity_id && (
          <Link to={`/app/opportunities/${f.opportunity_id}`} className="link text-sm">
            View opportunity
          </Link>
        )}
      </div>
    </Modal>
  );
}
