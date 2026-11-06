import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CATEGORY_LABELS,
  EDUCATION_LABELS,
  EDUCATION_LEVELS,
  OPPORTUNITY_CATEGORIES,
} from '../../../shared/constants';
import { FormSections, type SectionDef } from '../../components/FormBuilder';
import {
  Alert,
  Button,
  ErrorAlert,
  Modal,
  SelectInput,
  Spinner,
  TextInput,
  useLoad,
  useToast,
} from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { fmtDateTime } from '../../lib/format';
import { StatusPill } from './AdminLayout';

const toLocal = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');

const MAIN: SectionDef[] = [
  {
    title: 'Listing',
    fields: [
      { key: 'title', label: 'Title', type: 'text', wide: true },
      { key: 'organization', label: 'Organisation / buyer / funder', type: 'text' },
      {
        key: 'category',
        label: 'Category',
        type: 'select',
        options: OPPORTUNITY_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })),
        placeholder: undefined,
      },
      { key: 'country', label: 'Country', type: 'text' },
      { key: 'location', label: 'Location / place of performance', type: 'text' },
      {
        key: 'remote',
        label: 'Work mode',
        type: 'select',
        options: ['onsite', 'remote', 'hybrid', 'unknown'].map((v) => ({ value: v, label: v })),
      },
      { key: 'reference_no', label: 'Reference / tender number', type: 'text' },
      { key: 'summary', label: 'Summary (optional)', type: 'textarea' },
      { key: 'description', label: 'Full description (plain text)', type: 'textarea' },
    ],
  },
  {
    title: 'Links and provenance',
    description: 'Never use an aggregator URL as the official application URL.',
    fields: [
      { key: 'source_url', label: 'Source URL (where it was found)', type: 'text', wide: true },
      { key: 'official_url', label: 'Official page URL', type: 'text', wide: true },
      { key: 'application_url', label: 'Application / submission URL', type: 'text', wide: true },
    ],
  },
];

const REQ: SectionDef[] = [
  {
    title: 'Requirements',
    description: 'Only record what the official notice states. Leave blank if not stated.',
    fields: [
      {
        key: 'applicant_type',
        label: 'Who can apply',
        type: 'select',
        options: [
          { value: 'individual', label: 'Individuals' },
          { value: 'business', label: 'Registered businesses' },
          { value: 'either', label: 'Either' },
          { value: 'unknown', label: 'Not stated' },
        ],
        placeholder: undefined,
      },
      { key: 'eligible_countries', label: 'Eligible nationalities / countries', type: 'tags' },
      {
        key: 'education_level',
        label: 'Minimum education',
        type: 'select',
        options: EDUCATION_LEVELS.map((l) => ({ value: l, label: EDUCATION_LABELS[l] })),
      },
      { key: 'min_experience_years', label: 'Minimum years of experience', type: 'number', min: 0 },
      {
        key: 'degree_levels',
        label: 'Levels offered (scholarships)',
        type: 'chips',
        options: ['bachelor', 'master', 'phd', 'postdoc', 'short_course', 'exchange'].map((v) => ({
          value: v,
          label: v,
        })),
      },
      {
        key: 'funding',
        label: 'Funding',
        type: 'select',
        options: [
          { value: 'full', label: 'Fully funded' },
          { value: 'partial', label: 'Partially funded' },
          { value: 'unknown', label: 'Not stated' },
        ],
        placeholder: undefined,
      },
      { key: 'min_gpa', label: 'Minimum GPA', type: 'number', step: 0.01 },
      { key: 'gpa_scale', label: 'GPA scale', type: 'number' },
      { key: 'fields', label: 'Fields / disciplines', type: 'tags' },
      { key: 'skills', label: 'Skills', type: 'tags' },
      { key: 'languages', label: 'Languages', type: 'tags' },
      { key: 'registration_required', label: 'Registered business required', type: 'tristate' },
      { key: 'tax_clearance_required', label: 'Tax clearance required', type: 'tristate' },
      { key: 'min_turnover_ugx', label: 'Minimum turnover (UGX)', type: 'number', min: 0 },
      { key: 'min_years_in_operation', label: 'Minimum years in operation', type: 'number', min: 0 },
      { key: 'min_past_contracts', label: 'Minimum similar past contracts', type: 'number', min: 0 },
      {
        key: 'procurement_categories',
        label: 'Procurement category',
        type: 'chips',
        options: ['works', 'goods', 'services', 'consultancy'].map((v) => ({ value: v, label: v })),
      },
      { key: 'certifications', label: 'Required certifications', type: 'tags' },
      { key: 'licenses', label: 'Required licences', type: 'tags' },
      { key: 'required_documents', label: 'Required documents', type: 'tags' },
    ],
  },
];

export default function OpportunityEdit() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const sources = useLoad(() => api.get('/admin/sources'), []);
  const [o, setO] = useState<any>(
    id
      ? null
      : {
          category: 'scholarship',
          remote: 'unknown',
          status: 'open',
          verification: 'admin_verified',
          countries: [],
          meta: {},
          source_id: '',
        },
  );
  const [req, setReq] = useState<any>({ applicant_type: 'unknown', funding: 'unknown' });
  const [events, setEvents] = useState<any[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [merge, setMerge] = useState(false);
  const [into, setInto] = useState('');
  const [link, setLink] = useState<any>(null);
  useEffect(() => {
    if (!id) return;
    api
      .get(`/admin/opportunities/${id}`)
      .then((r) => {
        const x = r.opportunity;
        setO({
          ...x,
          source_id: x.source.id,
          deadline_at: toLocal(x.deadline_at),
          published_at: toLocal(x.published_at),
        });
        setReq(x.requirements ?? {});
        setEvents(r.events);
      })
      .catch(setErr);
  }, [id]);
  if (!o) return err ? <ErrorAlert error={err} /> : <Spinner />;
  const details = err instanceof ApiError ? (err.details ?? {}) : {};
  const save = async () => {
    setBusy(true);
    setErr(null);
    const payload = {
      category: o.category,
      title: o.title ?? '',
      organization: o.organization ?? '',
      description: o.description ?? '',
      summary: o.summary ?? '',
      country: o.country ?? '',
      countries: o.country ? [o.country] : [],
      location: o.location ?? '',
      remote: o.remote ?? 'unknown',
      source_id: o.source_id,
      source_url: o.source_url ?? '',
      application_url: o.application_url ?? '',
      official_url: o.official_url ?? '',
      reference_no: o.reference_no ?? '',
      published_at: o.published_at ? new Date(o.published_at).toISOString() : '',
      deadline_at: o.deadline_at ? new Date(o.deadline_at).toISOString() : '',
      deadline_tz: o.deadline_tz ?? 'Africa/Kampala',
      status: o.status,
      verification: o.verification,
      meta: o.meta ?? {},
      requirements: req,
    };
    try {
      if (id) await api.put(`/admin/opportunities/${id}`, payload);
      else {
        const r = await api.post('/admin/opportunities', payload);
        nav(`/admin/opportunities/${r.id}`, { replace: true });
      }
      toast('Saved');
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
  const moderate = async (action: string) => {
    await api.post(`/admin/opportunities/${id}/moderate`, { action });
    toast(`Done: ${action}`);
    const r = await api.get(`/admin/opportunities/${id}`);
    setO({
      ...o,
      status: r.opportunity.status,
      verification: r.opportunity.verification,
      moderation: r.opportunity.moderation,
    });
    setEvents(r.events);
  };
  return (
    <div className="pb-20">
      <Link
        to="/admin/opportunities"
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-500"
      >
        <ArrowLeft className="h-4 w-4" /> Opportunities
      </Link>
      <h1 className="mb-4 text-2xl font-bold">{id ? 'Edit opportunity' : 'Add curated opportunity'}</h1>
      {!id && (
        <Alert tone="info" className="mb-4">
          Copy facts only from the official funder, employer or procuring-entity page. Record its URL as the
          official URL.
        </Alert>
      )}
      <ErrorAlert error={err} className="mb-4" />
      {id && (
        <div className="card mb-6 flex flex-wrap items-center gap-2 p-4">
          <StatusPill s={o.status} />
          <StatusPill s={o.verification} />
          {o.moderation && <StatusPill s={o.moderation} />}
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => moderate('verify')}>
              Mark admin-verified
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => setLink(await api.post(`/admin/opportunities/${id}/check-link`))}
            >
              Check link
            </Button>
            <Button size="sm" variant="outline" onClick={() => moderate('expire')}>
              Expire
            </Button>
            <Button size="sm" variant="outline" onClick={() => moderate('cancel')}>
              Cancelled
            </Button>
            <Button size="sm" variant="outline" onClick={() => moderate('reopen')}>
              Reopen
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMerge(true)}>
              Merge duplicate…
            </Button>
            <Button size="sm" variant="danger" onClick={() => moderate('reject')}>
              Reject
            </Button>
          </div>
          {link && (
            <p className="w-full text-xs text-ink-600">
              Link check: HTTP {link.status || '—'} {link.error && `(${link.error})`}{' '}
              {link.ats_host && `· recognised ATS: ${link.ats_host}`}
            </p>
          )}
        </div>
      )}
      <div className="card mb-6 grid gap-4 p-5 sm:grid-cols-4">
        <SelectInput
          label="Source"
          value={o.source_id}
          onChange={(e) => setO({ ...o, source_id: e.target.value })}
          placeholder="Choose source"
          options={(sources.data?.sources ?? []).map((s: any) => ({ value: s.id, label: s.name }))}
          error={details.source_id}
        />
        <SelectInput
          label="Verification"
          value={o.verification}
          onChange={(e) => setO({ ...o, verification: e.target.value })}
          options={[
            'admin_verified',
            'verified_official',
            'verified_ats',
            'aggregator_only',
            'unverified',
          ].map((v) => ({ value: v, label: v.replace('_', ' ') }))}
        />
        <TextInput
          label="Deadline (local time)"
          type="datetime-local"
          value={o.deadline_at ?? ''}
          onChange={(e) => setO({ ...o, deadline_at: e.target.value })}
        />
        <TextInput
          label="Deadline timezone"
          value={o.deadline_tz ?? 'Africa/Kampala'}
          onChange={(e) => setO({ ...o, deadline_tz: e.target.value })}
        />
      </div>
      <FormSections sections={MAIN} data={o} errors={details} onChange={(k, v) => setO({ ...o, [k]: v })} />
      <div className="mt-6">
        <FormSections sections={REQ} data={req} onChange={(k, v) => setReq({ ...req, [k]: v })} />
      </div>
      {events.length > 0 && (
        <section className="card mt-6 p-5">
          <h2 className="font-bold">History</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {events.map((e) => (
              <li key={e.id}>
                <span className="font-semibold">{e.kind}</span> · {fmtDateTime(e.created_at)} ·{' '}
                <span className="text-ink-500">{e.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white">
        <div className="container-page flex justify-end py-3">
          <Button loading={busy} onClick={save}>
            Save opportunity
          </Button>
        </div>
      </div>
      <Modal
        open={merge}
        onClose={() => setMerge(false)}
        title="Merge into another opportunity"
        footer={
          <Button
            variant="danger"
            disabled={!into}
            onClick={async () => {
              try {
                await api.post(`/admin/opportunities/${id}/merge`, { into: into.trim() });
                toast('Merged');
                nav(`/admin/opportunities/${into.trim()}`);
              } catch (e) {
                setErr(e);
              }
              setMerge(false);
            }}
          >
            Merge
          </Button>
        }
      >
        <p className="mb-3 text-sm text-ink-600">
          Only merge genuine duplicates of the same notice. Saves, applications and source records move to the
          target; this record is closed.
        </p>
        <TextInput
          label="Target opportunity ID"
          value={into}
          onChange={(e) => setInto(e.target.value)}
          placeholder="opp_…"
        />
      </Modal>
    </div>
  );
}
