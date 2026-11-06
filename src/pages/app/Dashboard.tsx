import { ArrowRight, Bell, Bookmark, CalendarClock, FileText, ListChecks, Plus, Radar } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { APPLICATION_STATUS_LABELS, PROFILE_TYPES } from '../../../shared/constants';
import { OpportunityCard, type OppSummary } from '../../components/opportunity';
import { EmptyState, ErrorAlert, Progress, Spinner, useLoad } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { deadlineLabel, fmtDate, relTime } from '../../lib/format';
import { PROFILE_META } from './profileConfigs';
import { PROFILE_ICONS } from './Profiles';

type Dash = {
  profiles: Array<{
    id: string;
    type: 'career' | 'academic' | 'business';
    completeness: number;
    missing: string[];
  }>;
  top_matches: OppSummary[];
  deadlines: OppSummary[];
  saved_count: number;
  applications: any[];
  alerts: any[];
  discovery: {
    last_run: { status: string; started_at: string; finished_at: string | null; items_new: number } | null;
    open_opportunities: number;
  };
};

export default function Dashboard() {
  const { me } = useAuth();
  const { data, error, loading } = useLoad(() => api.get<Dash>('/dashboard'), []);
  if (me.user && !me.user.onboarded_at && !me.profiles?.length)
    return <Navigate to="/app/onboarding" replace />;
  if (loading) return <Spinner />;
  if (error || !data) return <ErrorAlert error={error} />;
  const have = new Set(data.profiles.map((p) => p.type));
  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-[28px] font-bold">Hello, {me.user?.name.split(' ')[0]}</h1>
          <p className="text-ink-500">
            {data.discovery.open_opportunities.toLocaleString()} open opportunities
            {data.discovery.last_run && (
              <> · last discovery run {relTime(data.discovery.last_run.started_at)}</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.profiles.map((p) => (
            <Link key={p.type} to={`/app/opportunities?view=${p.type}`} className="btn btn-sm btn-secondary">
              {PROFILE_META[p.type].title.replace(' profile', '')} matches
            </Link>
          ))}
        </div>
      </div>

      {/* Profiles */}
      <section className="grid gap-4 md:grid-cols-3">
        {PROFILE_TYPES.map((t) => {
          const p = data.profiles.find((x) => x.type === t);
          const Icon = PROFILE_ICONS[t];
          return p ? (
            <Link key={t} to={`/app/profiles/${t}`} className="card p-5 transition-shadow hover:shadow-paper">
              <div className="flex items-center gap-3">
                <Icon className="h-6 w-6 text-brand-500" />
                <h2 className="font-bold">{PROFILE_META[t].title}</h2>
                <span className="ml-auto text-sm font-bold">{p.completeness}%</span>
              </div>
              <Progress value={p.completeness} className="mt-3" />
              <p className="mt-2 text-xs text-ink-500">
                {p.missing.length
                  ? `Add: ${p.missing.slice(0, 3).join(', ')}`
                  : 'Complete — great matches ahead'}
              </p>
            </Link>
          ) : (
            <Link
              key={t}
              to={`/app/profiles/${t}`}
              className="flex items-center gap-3 rounded-lg border-2 border-dashed border-ink-200 p-5 text-ink-500 hover:border-brand-300 hover:text-brand-600"
            >
              <Plus className="h-5 w-5" />
              <span className="font-semibold">Add {PROFILE_META[t].title.toLowerCase()}</span>
            </Link>
          );
        })}
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Radar className="h-5 w-5 text-brand-500" /> Top matches for you
            </h2>
            <Link to="/app/opportunities" className="text-sm font-semibold text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          {data.top_matches.length ? (
            <div className="space-y-3">
              {data.top_matches.map((o) => (
                <OpportunityCard key={o.id} o={o} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Radar className="h-10 w-10" />}
              title={have.size ? 'No strong matches right now' : 'Create a profile to get matches'}
              action={
                <Link
                  to={have.size ? '/app/opportunities' : '/app/profiles'}
                  className="btn btn-md btn-primary"
                >
                  {have.size ? 'Browse your matches' : 'Create a profile'}
                </Link>
              }
            >
              {have.size
                ? 'Opportunities that are eligible or potential matches with relevance of 40+ appear here. Add more detail to your profile to improve matching.'
                : 'Matches are calculated from your profile facts.'}
            </EmptyState>
          )}
        </section>
        <aside className="space-y-6">
          <div className="card p-5">
            <h2 className="flex items-center gap-2 font-bold">
              <CalendarClock className="h-5 w-5 text-warn-500" /> Deadlines approaching
            </h2>
            {data.deadlines.length ? (
              <ul className="mt-3 divide-y divide-ink-100">
                {data.deadlines.map((o) => (
                  <li key={o.id} className="py-2.5">
                    <Link
                      to={`/app/opportunities/${o.id}`}
                      className="line-clamp-1 text-sm font-semibold hover:text-brand-600"
                    >
                      {o.title}
                    </Link>
                    <p className="text-xs text-warn-700">{deadlineLabel(o.deadline_at).text}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-500">
                Saved opportunities closing in the next 14 days appear here.
              </p>
            )}
            <Link
              to="/app/saved"
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-600"
            >
              <Bookmark className="h-4 w-4" /> {data.saved_count} saved <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="card p-5">
            <h2 className="flex items-center gap-2 font-bold">
              <ListChecks className="h-5 w-5 text-brand-500" /> Applications &amp; follow-ups
            </h2>
            {data.applications.length ? (
              <ul className="mt-3 divide-y divide-ink-100">
                {data.applications.map((a) => (
                  <li key={a.id} className="py-2.5">
                    <p className="line-clamp-1 text-sm font-semibold">{a.title}</p>
                    <p className="text-xs text-ink-500">
                      {APPLICATION_STATUS_LABELS[a.status as keyof typeof APPLICATION_STATUS_LABELS] ??
                        a.status}
                      {a.follow_up_at && <> · follow up {fmtDate(a.follow_up_at)}</>}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-500">Track what you applied for and when to follow up.</p>
            )}
            <Link
              to="/app/tracker"
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-600"
            >
              Open tracker <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="card p-5">
            <h2 className="flex items-center gap-2 font-bold">
              <Bell className="h-5 w-5 text-brand-500" /> Recent alerts
            </h2>
            {data.alerts.length ? (
              <ul className="mt-3 space-y-2">
                {data.alerts.map((n) => (
                  <li key={n.id}>
                    <Link
                      to={n.link ?? '/app/notifications'}
                      className={`line-clamp-2 text-sm ${n.read_at ? 'text-ink-500' : 'font-semibold'}`}
                    >
                      {n.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-500">No alerts yet.</p>
            )}
          </div>
          <Link to="/app/cvs" className="card flex items-center gap-3 p-5 hover:shadow-paper">
            <FileText className="h-6 w-6 text-brand-500" />
            <div>
              <p className="font-bold">CV Builder</p>
              <p className="text-sm text-ink-500">Create, tailor and download your CVs</p>
            </div>
            <ArrowRight className="ml-auto h-5 w-5 text-ink-400" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
