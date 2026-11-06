import { CATEGORY_LABELS } from '../../../shared/constants';
import { Spinner, cx, useLoad } from '../../components/ui';
import { api } from '../../lib/api';
import { relTime } from '../../lib/format';

const TYPE_LABEL: Record<string, string> = {
  official: 'Official',
  ats: 'Employer ATS',
  aggregator: 'Aggregator',
  partner: 'Partner',
  curated: 'Admin-curated',
};

export default function Sources() {
  const { data, loading } = useLoad(() => api.get<{ sources: any[] }>('/public/sources'), []);
  return (
    <section className="py-14">
      <div className="container-page max-w-4xl">
        <h1 className="text-[34px] font-extrabold sm:text-[42px]">Our opportunity sources</h1>
        <p className="mt-3 text-lg text-ink-600">
          We only use official portals, documented public APIs and feeds, and listings our administrators
          verify. We do not scrape sites that forbid it, bypass logins or CAPTCHAs.
        </p>
        {loading || !data ? (
          <Spinner />
        ) : (
          <div className="mt-8 space-y-4">
            {data.sources.map((s) => (
              <div key={s.name} className={cx('card p-5', !s.enabled && 'opacity-60')}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-bold">{s.name}</h2>
                    <p className="text-sm text-ink-500">{s.owner}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="chip bg-ink-100 text-ink-600">
                      {TYPE_LABEL[s.source_type] ?? s.source_type}
                    </span>
                    <span className="chip bg-ink-100 text-ink-600">
                      {s.automation === 'curated' ? 'Manually curated' : 'Automated'}
                    </span>
                    <span
                      className={cx('chip', s.enabled ? 'bg-ok-50 text-ok-700' : 'bg-ink-100 text-ink-500')}
                    >
                      {s.enabled ? 'Active' : 'Not yet active'}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-sm text-ink-600">
                  {s.categories.map((c: keyof typeof CATEGORY_LABELS) => CATEGORY_LABELS[c] ?? c).join(', ')}{' '}
                  · {s.geography.join(', ')}
                </p>
                <p className="mt-1 text-xs text-ink-400">
                  {s.open_items} open listing{s.open_items === 1 ? '' : 's'} · last successful check{' '}
                  {relTime(s.last_success_at)}
                  {s.terms_url && (
                    <>
                      {' · '}
                      <a className="underline" href={s.terms_url} target="_blank" rel="noopener noreferrer">
                        source terms
                      </a>
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
