import { Filter, Radar, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CATEGORIES_BY_PROFILE,
  CATEGORY_LABELS,
  OPPORTUNITY_CATEGORIES,
  type ProfileType,
} from '../../../shared/constants';
import { OpportunityCard, type OppSummary } from '../../components/opportunity';
import {
  Alert,
  Button,
  EmptyState,
  ErrorAlert,
  Pagination,
  SelectInput,
  Spinner,
  Tabs,
  cx,
  useLoad,
  useToast,
} from '../../components/ui';
import { api, qs } from '../../lib/api';
import { useAuth } from '../../lib/auth';

type Feed = {
  items: OppSummary[];
  total: number;
  page: number;
  pages: number;
  matched: boolean;
  needs_profile?: boolean;
  gated?: string;
  capped?: boolean;
};

export default function Opportunities({ publicMode = false }: { publicMode?: boolean }) {
  const { me } = useAuth();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const view = (publicMode ? 'all' : (sp.get('view') ?? me.profiles?.[0]?.type ?? 'all')) as
    | ProfileType
    | 'all';
  const params = {
    view,
    q: sp.get('q') ?? '',
    category: sp.get('category') ?? '',
    country: sp.get('country') ?? '',
    remote: sp.get('remote') ?? '',
    verification: sp.get('verification') ?? '',
    deadline_days: sp.get('deadline_days') ?? '',
    published_days: sp.get('published_days') ?? '',
    eligibility: sp.get('eligibility') ?? '',
    min_score: sp.get('min_score') ?? '',
    sort: sp.get('sort') ?? (view === 'all' ? 'newest' : 'match'),
    page: sp.get('page') ?? '1',
  };
  const [q, setQ] = useState(params.q);
  const [showFilters, setShowFilters] = useState(false);
  useEffect(() => {
    setQ(params.q);
  }, [params.q]);
  const { data, error, loading, setData } = useLoad(
    () => api.get<Feed>(`/opportunities${qs(params)}`),
    [sp.toString(), view],
  );
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(sp);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== 'page') next.delete('page');
    setSp(next);
  };
  const cats = view === 'all' ? OPPORTUNITY_CATEGORIES : CATEGORIES_BY_PROFILE[view];
  const hasProfile = (t: string) => me.profiles?.some((p) => p.type === t);

  const toggleSave = async (o: OppSummary) => {
    if (!me.user) return;
    const saved = o.user_state === 'saved';
    await (saved ? api.del(`/opportunities/${o.id}/state`) : api.post(`/opportunities/${o.id}/save`));
    setData(
      (d) =>
        d && {
          ...d,
          items: d.items.map((x) => (x.id === o.id ? { ...x, user_state: saved ? null : 'saved' } : x)),
        },
    );
    toast(saved ? 'Removed from saved' : 'Saved — we will remind you before the deadline');
  };
  const dismiss = async (o: OppSummary) => {
    await api.post(`/opportunities/${o.id}/dismiss`);
    setData((d) => d && { ...d, items: d.items.filter((x) => x.id !== o.id), total: d.total - 1 });
    toast('Hidden from your feed', 'info');
  };

  const filters = (
    <div className="space-y-4">
      <SelectInput
        label="Category"
        value={params.category}
        onChange={(e) => set('category', e.target.value)}
        placeholder="All categories"
        options={cats.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
      />
      <SelectInput
        label="Country"
        value={params.country}
        onChange={(e) => set('country', e.target.value)}
        placeholder="Any"
        options={['Uganda', 'Kenya', 'Tanzania', 'Rwanda', 'Burundi', 'South Sudan'].map((c) => ({
          value: c,
          label: c,
        }))}
      />
      <SelectInput
        label="Deadline"
        value={params.deadline_days}
        onChange={(e) => set('deadline_days', e.target.value)}
        placeholder="Any time"
        options={[
          { value: '7', label: 'Within 7 days' },
          { value: '14', label: 'Within 14 days' },
          { value: '30', label: 'Within 30 days' },
        ]}
      />
      <SelectInput
        label="Published"
        value={params.published_days}
        onChange={(e) => set('published_days', e.target.value)}
        placeholder="Any time"
        options={[
          { value: '1', label: 'Last 24 hours' },
          { value: '7', label: 'Last 7 days' },
          { value: '30', label: 'Last 30 days' },
        ]}
      />
      {data?.matched && (
        <>
          <SelectInput
            label="Eligibility"
            value={params.eligibility}
            onChange={(e) => set('eligibility', e.target.value)}
            placeholder="Any"
            options={[
              { value: 'eligible', label: 'Eligible' },
              { value: 'potential', label: 'Potential match' },
              { value: 'insufficient', label: 'Insufficient information' },
              { value: 'not_eligible', label: 'Not eligible' },
            ]}
          />
          <SelectInput
            label="Minimum relevance"
            value={params.min_score}
            onChange={(e) => set('min_score', e.target.value)}
            placeholder="Any"
            options={['40', '60', '75'].map((v) => ({ value: v, label: `${v}+` }))}
          />
        </>
      )}
      <label className="flex items-center gap-2 text-sm font-medium text-ink-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-ink-300"
          checked={params.verification === 'verified'}
          onChange={(e) => set('verification', e.target.checked ? 'verified' : '')}
        />
        Verified sources only
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-ink-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-ink-300"
          checked={params.remote === 'remote'}
          onChange={(e) => set('remote', e.target.checked ? 'remote' : '')}
        />
        Remote only
      </label>
    </div>
  );

  return (
    <div className={publicMode ? 'container-page py-10' : ''}>
      <div className="mb-5 flex flex-col gap-1">
        <h1 className="text-[28px] font-bold">
          {publicMode ? 'Opportunities in Uganda & East Africa' : 'Opportunities'}
        </h1>
        <p className="text-ink-500">
          {publicMode ? (
            <>
              Browse openly.{' '}
              <Link to="/signup" className="link">
                Create a free profile
              </Link>{' '}
              to see how well each one matches you.
            </>
          ) : (
            'Ranked for your profile. Eligibility and relevance are shown separately.'
          )}
        </p>
      </div>
      {!publicMode && (
        <Tabs
          className="mb-5"
          value={view}
          onChange={(v) => {
            const next = new URLSearchParams();
            next.set('view', v);
            setSp(next);
          }}
          tabs={[
            { value: 'career', label: 'Career' },
            { value: 'academic', label: 'Academic' },
            { value: 'business', label: 'Business' },
            { value: 'all', label: 'All' },
          ]}
        />
      )}
      <form
        className="mb-5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          set('q', q.trim());
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, organisation or location"
            className="input pl-11"
            aria-label="Search opportunities"
          />
        </div>
        <Button type="submit">Search</Button>
        <Button
          type="button"
          variant="outline"
          className="lg:hidden"
          onClick={() => setShowFilters(true)}
          aria-label="Filters"
        >
          <Filter className="h-4 w-4" />
        </Button>
      </form>
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <div className="card sticky top-24 p-4">{filters}</div>
        </aside>
        {showFilters && (
          <div className="fixed inset-0 z-50 bg-ink/50 lg:hidden" onClick={() => setShowFilters(false)}>
            <div
              className="absolute inset-y-0 right-0 w-80 max-w-[90%] overflow-y-auto bg-white p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-bold">Filters</h2>
                <button onClick={() => setShowFilters(false)} aria-label="Close filters">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {filters}
            </div>
          </div>
        )}
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink-500">
              {data
                ? `${data.total.toLocaleString()} result${data.total === 1 ? '' : 's'}${data.capped ? ' (most recent 400 ranked)' : ''}`
                : ' '}
            </p>
            <select
              value={params.sort}
              onChange={(e) => set('sort', e.target.value)}
              className="rounded border border-ink-200 bg-white px-3 py-1.5 text-sm"
              aria-label="Sort"
            >
              {view !== 'all' && <option value="match">Best match</option>}
              <option value="deadline">Deadline soonest</option>
              <option value="newest">Newest</option>
            </select>
          </div>
          {!publicMode && view !== 'all' && !hasProfile(view) && (
            <Alert tone="info" className="mb-4" title={`Create your ${view} profile to see matches`}>
              Opportunities below are not ranked yet.{' '}
              <Link to={`/app/profiles/${view}`} className="font-semibold underline">
                Create profile
              </Link>
            </Alert>
          )}
          {data?.gated === 'business_matching' && (
            <Alert tone="warn" className="mb-4" title="Business tender matching is a paid feature">
              You can browse every tender. Match scores for business profiles are included from the Basic
              plan.{' '}
              <Link to="/pricing" className="font-semibold underline">
                Compare plans
              </Link>
            </Alert>
          )}
          <ErrorAlert error={error} />
          {loading ? (
            <Spinner />
          ) : data && data.items.length ? (
            <div className={cx('space-y-3')}>
              {data.items.map((o) => (
                <OpportunityCard
                  key={o.id}
                  o={o}
                  linkBase={publicMode ? '/opportunities' : '/app/opportunities'}
                  onSave={me.user && !publicMode ? toggleSave : undefined}
                  onDismiss={me.user && !publicMode ? dismiss : undefined}
                />
              ))}
              <Pagination page={data.page} pages={data.pages} onPage={(p) => set('page', String(p))} />
            </div>
          ) : (
            <EmptyState icon={<Radar className="h-10 w-10" />} title="No opportunities match these filters">
              Try removing a filter. New opportunities are added as sources are checked (every six hours by
              default).
            </EmptyState>
          )}
        </div>
      </div>
    </div>
  );
}
