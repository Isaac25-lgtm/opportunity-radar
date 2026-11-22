import { Check, Minus } from 'lucide-react';
import { PROFILE_TYPES } from '../../../shared/constants';
import {
  ENTITLEMENT_LABELS,
  SEGMENT_LABELS,
  allowsProfileType,
  formatLimit,
  type Entitlements,
} from '../../../shared/entitlements';
import { formatMoney } from '../../../shared/money';
import { Alert, ButtonLink, Spinner, cx, useLoad } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

type Plan = {
  code: string;
  name: string;
  description: string;
  price_minor: number;
  currency: string;
  entitlements: Entitlements;
};

export function PlanValue({ k, v }: { k: keyof Entitlements; v: Entitlements[keyof Entitlements] }) {
  if (typeof v === 'boolean')
    return v ? (
      <Check className="mx-auto h-5 w-5 text-ok-500" aria-label="Included" />
    ) : (
      <Minus className="mx-auto h-5 w-5 text-ink-300" aria-label="Not included" />
    );
  if (Array.isArray(v)) return <span className="capitalize">{v.join(', ')}</span>;
  if (k === 'ai_requests_per_month' && v === 0)
    return <Minus className="mx-auto h-5 w-5 text-ink-300" aria-label="Not included" />;
  return <>{formatLimit(v as number)}</>;
}

export default function Pricing() {
  const { me } = useAuth();
  const { data, loading } = useLoad(
    () => api.get<{ plans: Plan[]; payments: { available: boolean; note: string } }>('/billing/plans'),
    [],
  );
  if (loading || !data) return <Spinner className="min-h-[50vh]" />;
  // Segments get their own rows; the remaining limits follow.
  const keys = (Object.keys(ENTITLEMENT_LABELS) as Array<keyof Entitlements>).filter(
    (k) => k !== 'profile_types',
  );
  return (
    <section className="py-14">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-[36px] font-semibold sm:text-[46px]">Simple monthly plans</h1>
          <p className="mt-3 text-lg text-ink-600">
            Browsing every listing is free. Pick the plan that matches what you are looking for: jobs,
            scholarships, or contracts for your company.
          </p>
        </div>
        {!data.payments.available && (
          <Alert tone="warn" className="mx-auto mt-6 max-w-2xl">
            {data.payments.note} You can use the Free plan in the meantime.
          </Alert>
        )}
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {data.plans.map((p) => {
            const featured = p.code === 'pro';
            return (
              <div
                key={p.code}
                className={cx('card relative flex flex-col p-6', featured && 'ring-2 ring-ink')}
              >
                {featured && (
                  <span className="absolute -top-3 left-6 rounded-full bg-ink px-3 py-0.5 text-xs font-semibold text-white">
                    Most popular
                  </span>
                )}
                <h2 className="text-xl font-semibold">{p.name}</h2>
                <p className="mt-1 min-h-[40px] text-sm text-ink-500">{p.description}</p>
                <p className="mt-5 flex flex-wrap items-baseline gap-x-1.5">
                  <span className="whitespace-nowrap font-display text-[30px] font-semibold tracking-display">
                    {formatMoney(p.price_minor, p.currency)}
                  </span>
                  <span className="whitespace-nowrap text-sm text-ink-500">/ month</span>
                </p>
                <ul className="mt-5 space-y-2 border-b border-line pb-4 text-sm">
                  {PROFILE_TYPES.map((t) => {
                    const on = allowsProfileType(p.entitlements, t);
                    return (
                      <li key={t} className={cx('flex gap-2', on ? 'font-medium text-ink' : 'text-ink-400')}>
                        {on ? (
                          <Check className="mt-0.5 h-4 w-4 flex-none text-ok-500" aria-label="Included" />
                        ) : (
                          <Minus className="mt-0.5 h-4 w-4 flex-none" aria-label="Not included" />
                        )}
                        {SEGMENT_LABELS[t]}
                      </li>
                    );
                  })}
                </ul>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-ink-700">
                  <li>
                    {formatLimit(p.entitlements.max_profiles)} profile
                    {p.entitlements.max_profiles === 1 ? '' : 's'}
                  </li>
                  <li>
                    {formatLimit(p.entitlements.max_cvs)} CV{p.entitlements.max_cvs === 1 ? '' : 's'} ·{' '}
                    {formatLimit(p.entitlements.cv_exports_per_month)} exports/month
                  </li>
                  <li>{p.entitlements.docx_export ? 'PDF + Word export' : 'PDF export'}</li>
                  <li className="capitalize">{p.entitlements.alert_frequencies.join(', ')} alerts</li>
                  {p.entitlements.cover_letters && <li>Cover-letter drafts</li>}
                </ul>
                <ButtonLink
                  to={me.user ? (p.price_minor ? '/app/billing' : '/app') : '/signup'}
                  variant={featured ? 'primary' : 'secondary'}
                  className="mt-6 w-full"
                >
                  {p.price_minor ? 'Choose plan' : 'Start free'}
                </ButtonLink>
              </div>
            );
          })}
        </div>
        <div className="mt-16 overflow-x-auto">
          <h2 className="mb-4 text-2xl font-semibold">Compare plans</h2>
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink-200">
                <th className="py-3 text-left font-semibold text-ink-500">Feature</th>
                {data.plans.map((p) => (
                  <th key={p.code} className="py-3 text-center font-semibold">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PROFILE_TYPES.map((t) => (
                <tr key={t} className="border-b border-ink-100">
                  <td className="py-3 pr-4 font-medium text-ink">{SEGMENT_LABELS[t]}</td>
                  {data.plans.map((p) => (
                    <td key={p.code} className="py-3 text-center">
                      <PlanValue k="docx_export" v={allowsProfileType(p.entitlements, t)} />
                    </td>
                  ))}
                </tr>
              ))}
              {keys.map((k) => (
                <tr key={k} className="border-b border-ink-100">
                  <td className="py-3 pr-4 text-ink-700">{ENTITLEMENT_LABELS[k]}</td>
                  {data.plans.map((p) => (
                    <td key={p.code} className="py-3 text-center">
                      <PlanValue k={k} v={p.entitlements[k]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-ink-500">
            Prices in US dollars, billed monthly. Plans do not renew automatically; you choose when to pay
            again. AI assistance is not yet enabled.
          </p>
        </div>
      </div>
    </section>
  );
}
