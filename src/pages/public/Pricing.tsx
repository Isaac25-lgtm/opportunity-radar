import { Check, Minus } from 'lucide-react';
import { PROFILE_TYPES } from '../../../shared/constants';
import {
  ENTITLEMENT_LABELS,
  SEGMENT_LABELS,
  allowsProfileType,
  formatLimit,
  type Entitlements,
} from '../../../shared/entitlements';
import { PlanCards, usePlans } from '../../components/PlanCards';
import { Alert, Spinner } from '../../components/ui';

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
  const { data, loading } = usePlans();
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
        <div className="mt-10">
          <PlanCards plans={data.plans} />
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
