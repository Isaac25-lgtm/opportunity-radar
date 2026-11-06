import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Building2,
  CalendarClock,
  EyeOff,
  FileText,
  ListPlus,
  MapPin,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CATEGORY_LABELS, EDUCATION_LABELS } from '../../../shared/constants';
import {
  CategoryChip,
  MatchPanel,
  OutboundLink,
  STATE_HELP,
  VerificationBadge,
  type MatchResult,
  type OppSummary,
} from '../../components/opportunity';
import {
  Alert,
  Button,
  ErrorAlert,
  Modal,
  SelectInput,
  Spinner,
  useLoad,
  useToast,
} from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { deadlineLabel, fmtDate, fmtDateTime, relTime } from '../../lib/format';

type Detail = {
  opportunity: OppSummary & {
    description: string;
    meta: Record<string, any>;
    requirements: Record<string, any>;
    requirements_source: string;
  };
  events: Array<{ kind: string; detail: any; created_at: string }>;
  sources: Array<{
    name: string;
    source_type: string;
    url: string;
    first_seen_at: string;
    last_seen_at: string;
  }>;
  matches: MatchResult[];
  user_state: 'saved' | 'dismissed' | null;
  application?: { id: string; status: string; kind: string } | null;
};

const EVENT_LABEL: Record<string, string> = {
  created: 'First discovered',
  updated: 'Updated',
  deadline_changed: 'Deadline changed',
  status_changed: 'Status changed',
  verified: 'Verified',
  amended: 'Notice amended',
  url_changed: 'Application link changed',
  merged: 'Duplicate merged',
  link_checked: 'Link checked',
};

function Req({ r }: { r: Record<string, any> }) {
  const rows: Array<[string, string]> = [];
  const list = (v: unknown) => (Array.isArray(v) && v.length ? v.join(', ') : '');
  if (r.applicant_type && r.applicant_type !== 'unknown')
    rows.push([
      'Who can apply',
      {
        individual: 'Individuals',
        business: 'Registered businesses / firms',
        either: 'Individuals or organisations',
      }[r.applicant_type as string] ?? r.applicant_type,
    ]);
  if (list(r.eligible_countries)) rows.push(['Eligible countries', list(r.eligible_countries)]);
  if (r.education_level)
    rows.push(['Minimum education', EDUCATION_LABELS[r.education_level as keyof typeof EDUCATION_LABELS]]);
  if (list(r.degree_levels)) rows.push(['Levels', list(r.degree_levels)]);
  if (r.min_experience_years) rows.push(['Experience', `${r.min_experience_years}+ years`]);
  if (list(r.fields)) rows.push(['Fields', list(r.fields)]);
  if (list(r.skills)) rows.push(['Skills mentioned', list(r.skills)]);
  if (list(r.languages)) rows.push(['Languages', list(r.languages)]);
  if (r.min_gpa) rows.push(['Minimum grade', `${r.min_gpa}/${r.gpa_scale ?? 5}`]);
  if (r.funding && r.funding !== 'unknown')
    rows.push(['Funding', r.funding === 'full' ? 'Fully funded' : 'Partially funded']);
  if (r.registration_required) rows.push(['Registration', 'Registered business required']);
  if (r.tax_clearance_required) rows.push(['Tax', 'Valid tax clearance required']);
  if (r.min_turnover_ugx)
    rows.push(['Minimum turnover', `UGX ${Number(r.min_turnover_ugx).toLocaleString()}`]);
  if (r.min_years_in_operation) rows.push(['Years in operation', `${r.min_years_in_operation}+`]);
  if (r.min_past_contracts) rows.push(['Similar past contracts', `${r.min_past_contracts}+`]);
  if (list(r.certifications)) rows.push(['Certifications', list(r.certifications)]);
  if (list(r.licenses)) rows.push(['Licences', list(r.licenses)]);
  if (list(r.procurement_categories)) rows.push(['Procurement category', list(r.procurement_categories)]);
  if (list(r.required_documents)) rows.push(['Documents', list(r.required_documents)]);
  if (!rows.length && !r.notes?.length)
    return (
      <p className="text-sm text-ink-500">
        No structured requirements were extracted. Read the full notice on the official page.
      </p>
    );
  return (
    <>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[180px_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-sm font-semibold text-ink-500">{k}</dt>
            <dd className="text-sm text-ink-800">{v}</dd>
          </div>
        ))}
      </dl>
      {r.notes?.map((n: string) => (
        <p key={n} className="mt-3 text-sm text-ink-600">
          {n}
        </p>
      ))}
    </>
  );
}

export default function OpportunityDetail({ publicMode = false }: { publicMode?: boolean }) {
  const { id } = useParams();
  const { me } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const { data, error, loading, setData } = useLoad(() => api.get<Detail>(`/opportunities/${id}`), [id]);
  const [track, setTrack] = useState(false);
  const [cvPick, setCvPick] = useState(false);
  if (loading) return <Spinner />;
  if (error || !data)
    return (
      <div className={publicMode ? 'container-page py-10' : ''}>
        <ErrorAlert error={error} />
      </div>
    );
  const o = data.opportunity;
  const dl = deadlineLabel(o.deadline_at);
  const verified = ['verified_official', 'verified_ats', 'admin_verified'].includes(o.verification);
  const applyUrl = o.application_url || o.official_url || o.source_url;
  const isBid = [
    'tender',
    'rfp',
    'rfq',
    'eoi',
    'supplier_registration',
    'framework_agreement',
    'business_grant',
  ].includes(o.category);
  const closed = ['closed', 'expired', 'cancelled'].includes(o.display_state);
  const base = publicMode ? '/opportunities' : '/app/opportunities';

  const save = async () => {
    const saved = data.user_state === 'saved';
    await (saved ? api.del(`/opportunities/${o.id}/state`) : api.post(`/opportunities/${o.id}/save`));
    setData({ ...data, user_state: saved ? null : 'saved' });
    toast(saved ? 'Removed from saved' : 'Saved');
  };

  return (
    <div className={publicMode ? 'container-page py-8' : ''}>
      <Link
        to={base}
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to opportunities
      </Link>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <div className="card p-5 sm:p-7">
            <div className="flex flex-wrap gap-1.5">
              <CategoryChip category={o.category} />
              <VerificationBadge state={o.display_state} />
              {o.is_demo && <span className="chip bg-warn-500 text-white">DEMO DATA</span>}
            </div>
            <h1 className="mt-3 break-words text-2xl font-bold sm:text-[28px]">{o.title}</h1>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[15px] text-ink-600">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4" /> {o.organization}
              </span>
              {(o.location || o.country) && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" /> {o.location || o.country}
                  {o.remote !== 'unknown' && o.remote !== 'onsite' && ` (${o.remote})`}
                </span>
              )}
              <span className="flex items-center gap-1.5 font-semibold">
                <CalendarClock className="h-4 w-4" /> {dl.text}
              </span>
            </div>
            {o.deadline_at && (
              <p className="mt-2 text-sm text-ink-500">
                Deadline: {fmtDateTime(o.deadline_at, o.deadline_tz)}
                {o.deadline_note && ` — ${o.deadline_note}`}
              </p>
            )}
            {o.reference_no && <p className="mt-1 text-sm text-ink-500">Reference: {o.reference_no}</p>}
            {closed && (
              <Alert tone="warn" className="mt-4">
                {STATE_HELP[o.display_state]}
              </Alert>
            )}
            {o.display_state === 'aggregator_only' && (
              <Alert tone="warn" className="mt-4" title="Aggregator listing">
                {o.attribution ?? 'This listing comes from an aggregator.'} Try to confirm it on the
                employer’s own website before applying.
              </Alert>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              <OutboundLink href={applyUrl} verified={verified} className="btn btn-md btn-primary">
                {isBid ? 'View official notice' : 'Apply on official site'}
              </OutboundLink>
              {me.user && !publicMode && (
                <>
                  <Button variant="secondary" onClick={save}>
                    {data.user_state === 'saved' ? (
                      <BookmarkCheck className="h-4 w-4" />
                    ) : (
                      <Bookmark className="h-4 w-4" />
                    )}{' '}
                    {data.user_state === 'saved' ? 'Saved' : 'Save'}
                  </Button>
                  {data.application ? (
                    <Link to="/app/tracker" className="btn btn-md btn-outline">
                      <ListPlus className="h-4 w-4" /> In tracker
                    </Link>
                  ) : (
                    <Button variant="outline" onClick={() => setTrack(true)}>
                      <ListPlus className="h-4 w-4" /> Track {isBid ? 'bid' : 'application'}
                    </Button>
                  )}
                  {!isBid && (
                    <Button variant="outline" onClick={() => setCvPick(true)}>
                      <FileText className="h-4 w-4" /> Tailor CV
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      await api.post(`/opportunities/${o.id}/dismiss`);
                      toast('Hidden from your feed', 'info');
                      nav(base);
                    }}
                  >
                    <EyeOff className="h-4 w-4" /> Not interested
                  </Button>
                </>
              )}
              {!me.user && (
                <Link
                  to={`/signup?next=${encodeURIComponent(`/app/opportunities/${o.id}`)}`}
                  className="btn btn-md btn-secondary"
                >
                  Check my match
                </Link>
              )}
            </div>
            <p className="mt-3 text-xs text-ink-400">
              We never submit applications for you. Never pay a fee to apply.
            </p>
          </div>

          <section className="card p-5 sm:p-7">
            <h2 className="text-lg font-bold">Requirements</h2>
            {o.requirements_source === 'heuristic' && (
              <p className="mb-3 mt-1 text-xs text-ink-500">
                Extracted automatically from the notice text — confirm on the official page.
              </p>
            )}
            {o.requirements_source === 'none' && (
              <p className="mb-3 mt-1 text-xs text-ink-500">
                This source does not publish structured requirements.
              </p>
            )}
            <div className="mt-3">
              <Req r={o.requirements} />
            </div>
          </section>

          {o.description && (
            <section className="card p-5 sm:p-7">
              <h2 className="text-lg font-bold">Description</h2>
              <div className="prose-plain mt-3 max-h-[640px] overflow-y-auto">{o.description}</div>
            </section>
          )}

          {Object.keys(o.meta ?? {}).length > 0 && (
            <section className="card p-5 sm:p-7">
              <h2 className="text-lg font-bold">Details</h2>
              <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[180px_1fr]">
                {Object.entries(o.meta)
                  .filter(
                    ([k, v]) =>
                      v !== null &&
                      v !== '' &&
                      !(Array.isArray(v) && !v.length) &&
                      !['attribution', 'buyer_website'].includes(k) &&
                      typeof v !== 'object',
                  )
                  .map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="font-semibold capitalize text-ink-500">{k.replace(/_/g, ' ')}</dt>
                      <dd className="break-words text-ink-800">{String(v)}</dd>
                    </div>
                  ))}
              </dl>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          {!publicMode &&
            me.user &&
            data.matches.length > 0 &&
            data.matches.map((m) => <MatchPanel key={m.profile_type} m={m} />)}
          {!publicMode && me.user && data.matches.length === 0 && (
            <div className="card p-5 text-sm text-ink-600">
              None of your profiles is matched against {CATEGORY_LABELS[o.category].toLowerCase()}{' '}
              opportunities.{' '}
              <Link to="/app/profiles" className="link">
                Manage profiles
              </Link>
            </div>
          )}
          <div className="card p-5">
            <h2 className="font-bold">Source &amp; verification</h2>
            <p className="mt-2 text-sm text-ink-600">{STATE_HELP[o.display_state]}</p>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">Source</dt>
                <dd className="text-right font-medium">{o.source.name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">Last checked</dt>
                <dd className="font-medium">{relTime(o.last_checked_at)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">First seen</dt>
                <dd className="font-medium">{fmtDate(o.first_seen_at)}</dd>
              </div>
              {o.published_at && (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-500">Published</dt>
                  <dd className="font-medium">{fmtDate(o.published_at)}</dd>
                </div>
              )}
            </dl>
            <div className="mt-3 space-y-1 text-sm">
              {o.official_url && (
                <a
                  href={o.official_url}
                  className="block truncate text-brand-600 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Official page
                </a>
              )}
              <a
                href={o.source_url}
                className="block truncate text-brand-600 underline"
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                Where we found it
              </a>
            </div>
            {data.sources.length > 1 && (
              <p className="mt-2 text-xs text-ink-500">
                Also listed by {data.sources.length - 1} other source(s); duplicates are merged.
              </p>
            )}
          </div>
          {data.events.length > 0 && (
            <div className="card p-5">
              <h2 className="font-bold">History</h2>
              <ol className="mt-3 space-y-2 border-l-2 border-ink-100 pl-4 text-sm">
                {data.events.map((e, i) => (
                  <li key={i}>
                    <p className="font-semibold">{EVENT_LABEL[e.kind] ?? e.kind}</p>
                    <p className="text-xs text-ink-500">
                      {fmtDate(e.created_at)}
                      {e.detail?.to && ` · ${String(e.detail.to).slice(0, 40)}`}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </aside>
      </div>
      {track && (
        <TrackModal
          o={o}
          isBid={isBid}
          onClose={() => setTrack(false)}
          onDone={(appId) =>
            setData({
              ...data,
              application: { id: appId, status: 'interested', kind: isBid ? 'bid' : 'application' },
            })
          }
        />
      )}
      {cvPick && <TailorModal oppId={o.id} onClose={() => setCvPick(false)} />}
    </div>
  );
}

function TrackModal({
  o,
  isBid,
  onClose,
  onDone,
}: {
  o: OppSummary;
  isBid: boolean;
  onClose: () => void;
  onDone: (id: string) => void;
}) {
  const toast = useToast();
  const [status, setStatus] = useState('interested');
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Track this ${isBid ? 'bid' : 'application'}`}
      footer={
        <Button
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await api.post('/applications', {
                kind: isBid ? 'bid' : 'application',
                title: o.title,
                organization: o.organization,
                opportunity_id: o.id,
                status,
                deadline_at: o.deadline_at,
              });
              toast('Added to your tracker');
              onDone(r.id);
              onClose();
            } catch (e) {
              setErr(e);
              setBusy(false);
            }
          }}
        >
          Add to tracker
        </Button>
      }
    >
      <ErrorAlert error={err} className="mb-3" />
      <SelectInput
        label="Status"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        options={[
          { value: 'interested', label: 'Interested' },
          { value: 'preparing', label: 'Preparing' },
          { value: 'applied', label: 'Applied / submitted' },
        ]}
      />
    </Modal>
  );
}

function TailorModal({ oppId, onClose }: { oppId: string; onClose: () => void }) {
  const nav = useNavigate();
  const { data, loading } = useLoad(() => api.get<{ cvs: any[] }>('/cvs'), []);
  return (
    <Modal open onClose={onClose} title="Tailor a CV for this opportunity">
      {loading ? (
        <Spinner />
      ) : data?.cvs.length ? (
        <ul className="divide-y divide-ink-100">
          {data.cvs.map((c) => (
            <li key={c.id}>
              <button
                className="w-full py-3 text-left font-semibold hover:text-brand-600"
                onClick={() => nav(`/app/cvs/${c.id}/edit?tailor=${oppId}`)}
              >
                {c.title}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-600">
          You have no CVs yet.{' '}
          <Link to="/app/cvs" className="link">
            Create one
          </Link>
        </p>
      )}
    </Modal>
  );
}
