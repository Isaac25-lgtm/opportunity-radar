import { Briefcase, Building2, GraduationCap, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PROFILE_TYPES } from '../../../shared/constants';
import { formatLimit } from '../../../shared/entitlements';
import { Alert, PageHeader, Progress, Spinner, useLoad } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { relTime } from '../../lib/format';
import { PROFILE_META } from './profileConfigs';

export const PROFILE_ICONS = { career: Briefcase, academic: GraduationCap, business: Building2 };

export default function Profiles() {
  const { me } = useAuth();
  const { data, loading } = useLoad(() => api.get<{ profiles: any[] }>('/profiles'), []);
  if (loading || !data) return <Spinner />;
  const byType = Object.fromEntries(data.profiles.map((p) => [p.type, p]));
  const limit = me.plan?.entitlements.max_profiles ?? 1;
  const atLimit = limit >= 0 && data.profiles.length >= limit;
  return (
    <>
      <PageHeader
        title="Your profiles"
        subtitle={`Each profile is matched only against the opportunities that suit it. Your plan allows ${formatLimit(limit)} active profile${limit === 1 ? '' : 's'}.`}
      />
      {atLimit && data.profiles.length < 3 && (
        <Alert tone="info" className="mb-6">
          You are using all the profiles in your plan.{' '}
          <Link to="/pricing" className="font-semibold underline">
            Upgrade
          </Link>{' '}
          to add another type.
        </Alert>
      )}
      <div className="grid gap-5 md:grid-cols-3">
        {PROFILE_TYPES.map((t) => {
          const p = byType[t];
          const Icon = PROFILE_ICONS[t];
          return (
            <div key={t} className="card flex flex-col p-6">
              <Icon className="h-8 w-8 text-brand-500" />
              <h2 className="mt-4 text-lg font-bold">{PROFILE_META[t].title}</h2>
              <p className="mt-1 flex-1 text-sm text-ink-500">{PROFILE_META[t].blurb}</p>
              {p ? (
                <>
                  <div className="mt-5 flex justify-between text-sm">
                    <span>Completeness</span>
                    <span className="font-bold">{p.completeness}%</span>
                  </div>
                  <Progress value={p.completeness} className="mt-1" />
                  {p.missing?.length > 0 && (
                    <p className="mt-2 text-xs text-ink-500">Missing: {p.missing.slice(0, 3).join(', ')}</p>
                  )}
                  <p className="mt-2 text-xs text-ink-400">Updated {relTime(p.updated_at)}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link to={`/app/profiles/${t}`} className="btn btn-sm btn-secondary">
                      Edit
                    </Link>
                    <Link to={`/app/opportunities?view=${t}`} className="btn btn-sm btn-primary">
                      Matches
                    </Link>
                  </div>
                </>
              ) : atLimit ? (
                <Link to="/pricing" className="btn btn-sm btn-outline mt-5">
                  Upgrade to add
                </Link>
              ) : (
                <Link to={`/app/profiles/${t}`} className="btn btn-sm btn-primary mt-5">
                  <Plus className="h-4 w-4" /> Create
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
