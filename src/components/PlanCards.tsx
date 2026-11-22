import { Check, Minus } from 'lucide-react';
import { PROFILE_TYPES } from '../../shared/constants';
import { SEGMENT_LABELS, allowsProfileType, formatLimit, type Entitlements } from '../../shared/entitlements';
import { formatMoney } from '../../shared/money';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ButtonLink, cx, useLoad } from './ui';

export type Plan = {
  code: string;
  name: string;
  description: string;
  price_minor: number;
  currency: string;
  entitlements: Entitlements;
};

export type PlansResponse = { plans: Plan[]; payments: { available: boolean; note: string } };

export const usePlans = () => useLoad(() => api.get<PlansResponse>('/billing/plans'), []);

/** The plan most people choose; highlighted on the cards. */
const FEATURED = 'pro';

/** One card per plan: price, the segments it matches, the main limits and a call to action. */
export function PlanCards({ plans }: { plans: Plan[] }) {
  const { me } = useAuth();
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {plans.map((p) => {
        const featured = p.code === FEATURED;
        const e = p.entitlements;
        return (
          <div
            key={p.code}
            className={cx('card relative flex flex-col p-6', featured && '!shadow-card ring-2 ring-ink')}
          >
            {featured && (
              <span className="absolute -top-3 left-6 rounded-full bg-ink px-3 py-0.5 text-xs font-semibold text-white">
                Most popular
              </span>
            )}
            <h3 className="text-xl font-semibold">{p.name}</h3>
            <p className="mt-1 min-h-[40px] text-sm text-ink-500">{p.description}</p>
            <p className="mt-5 flex flex-wrap items-baseline gap-x-1.5">
              <span className="whitespace-nowrap font-display text-[30px] font-semibold tracking-display">
                {formatMoney(p.price_minor, p.currency)}
              </span>
              <span className="whitespace-nowrap text-sm text-ink-500">/ month</span>
            </p>
            <ul className="mt-5 space-y-2 border-b border-line pb-4 text-sm">
              {PROFILE_TYPES.map((t) => {
                const on = allowsProfileType(e, t);
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
                {formatLimit(e.max_profiles)} profile{e.max_profiles === 1 ? '' : 's'}
              </li>
              <li>
                {formatLimit(e.max_cvs)} CV{e.max_cvs === 1 ? '' : 's'} ·{' '}
                {formatLimit(e.cv_exports_per_month)} exports/month
              </li>
              <li>{e.docx_export ? 'PDF + Word export' : 'PDF export'}</li>
              <li className="capitalize">{e.alert_frequencies.join(', ')} alerts</li>
              {e.cover_letters && <li>Cover-letter drafts</li>}
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
  );
}
