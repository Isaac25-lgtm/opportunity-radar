import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatLimit } from '../../../shared/entitlements';
import { Alert, Button, ErrorAlert, PageHeader, Progress, Spinner, cx, useLoad } from '../../components/ui';
import { api } from '../../lib/api';
import { fmtDate, ugx } from '../../lib/format';

export default function Billing() {
  const billing = useLoad(() => api.get('/billing'), []);
  const plans = useLoad(() => api.get('/billing/plans'), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  if (billing.loading || plans.loading || !billing.data || !plans.data) return <Spinner />;
  const { plan, payments, usage } = billing.data;
  const e = plan.entitlements;
  const meter = (label: string, used: number, limit: number) => (
    <div key={label}>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-semibold">
          {used} / {formatLimit(limit)}
        </span>
      </div>
      <Progress
        value={limit < 0 ? 10 : (used / Math.max(1, limit)) * 100}
        className="mt-1"
        tone={limit >= 0 && used >= limit ? 'bg-bad-500' : 'bg-brand-500'}
      />
    </div>
  );
  const checkout = async (code: string) => {
    setBusy(code);
    setErr(null);
    try {
      const r = await api.post('/billing/checkout', { plan_code: code });
      window.location.assign(r.redirect_url);
    } catch (x) {
      setErr(x);
      setBusy(null);
    }
  };
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Billing & plan"
        subtitle={
          <>
            Compare all features on the{' '}
            <Link to="/pricing" className="link">
              pricing page
            </Link>
            .
          </>
        }
      />
      <ErrorAlert error={err} className="mb-4" />
      {!plans.data.payments.available && (
        <Alert tone="warn" className="mb-4">
          {plans.data.payments.note}
        </Alert>
      )}
      {plans.data.payments.available && plans.data.payments.provider !== 'pesapal' && (
        <Alert tone="info" className="mb-4">
          {plans.data.payments.note}
        </Alert>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <section className="card p-6">
          <p className="text-sm text-ink-500">Current plan</p>
          <p className="text-2xl font-bold">{plan.name}</p>
          {plan.period_end ? (
            <p className="text-sm text-ink-500">Active until {fmtDate(plan.period_end)}</p>
          ) : (
            <p className="text-sm text-ink-500">Free forever</p>
          )}
          <div className="mt-5 space-y-3">
            {meter('Profiles', usage.profiles, e.max_profiles)}
            {meter('CVs', usage.cvs, e.max_cvs)}
            {meter('CV exports this month', usage.cv_exports, e.cv_exports_per_month)}
            {meter('Documents', usage.documents, e.max_documents)}
            {meter('Tracked applications', usage.tracked, e.max_tracked)}
          </div>
        </section>
        <section className="space-y-3">
          {plans.data.plans
            .filter((p: any) => p.price_ugx > 0)
            .map((p: any) => (
              <div
                key={p.code}
                className={cx(
                  'card flex items-center justify-between gap-3 p-5',
                  p.code === plan.code && 'ring-2 ring-brand-500',
                )}
              >
                <div>
                  <p className="font-bold">{p.name}</p>
                  <p className="text-sm text-ink-500">{ugx(p.price_ugx)} / month</p>
                </div>
                <Button
                  size="sm"
                  loading={busy === p.code}
                  disabled={!plans.data.payments.available}
                  onClick={() => checkout(p.code)}
                >
                  {p.code === plan.code ? 'Extend 1 month' : 'Choose'}
                </Button>
              </div>
            ))}
          <p className="text-xs text-ink-500">
            Your plan activates only after the payment provider confirms payment to our server. Plans do not
            renew automatically.
          </p>
        </section>
      </div>
      <section className="card mt-6 overflow-x-auto p-6">
        <h2 className="text-lg font-bold">Payment history</h2>
        {payments.length ? (
          <table className="mt-3 w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-ink-500">
                <th className="py-2">Date</th>
                <th>Plan</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {payments.map((p: any) => (
                <tr key={p.merchant_reference}>
                  <td className="py-2">{fmtDate(p.created_at)}</td>
                  <td>{p.plan_name}</td>
                  <td>{ugx(p.amount)}</td>
                  <td className="capitalize">{p.status}</td>
                  <td className="font-mono text-xs">{p.merchant_reference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-2 text-sm text-ink-500">No payments yet.</p>
        )}
      </section>
    </div>
  );
}
