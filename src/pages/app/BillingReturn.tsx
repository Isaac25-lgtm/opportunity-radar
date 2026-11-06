import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, ButtonLink, ErrorAlert, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

/** Return page after checkout. The status shown comes from a server-side check with the provider. */
export default function BillingReturn() {
  const [sp] = useSearchParams();
  const { refresh } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  useEffect(() => {
    const tracking_id = sp.get('OrderTrackingId') ?? undefined;
    const merchant_reference = sp.get('OrderMerchantReference') ?? undefined;
    let tries = 0;
    const check = async () => {
      try {
        const r = await api.post('/billing/verify', { tracking_id, merchant_reference });
        setStatus(r.status);
        if (r.status === 'pending' && tries++ < 6) setTimeout(check, 4000);
        else void refresh();
      } catch (e) {
        setErr(e);
      }
    };
    void check();
  }, [sp, refresh]);
  return (
    <div className="mx-auto max-w-lg py-10">
      <div className="card p-6 text-center">
        <h1 className="text-xl font-bold">Payment status</h1>
        <ErrorAlert error={err} className="mt-4" />
        {!status && !err && <Spinner label="Confirming with the payment provider…" />}
        {status === 'completed' && (
          <Alert tone="ok" className="mt-4" title="Payment confirmed">
            Your plan is now active.
          </Alert>
        )}
        {status === 'pending' && (
          <Alert tone="info" className="mt-4" title="Still processing">
            The provider has not confirmed yet. We will activate your plan automatically when it does.
          </Alert>
        )}
        {status && !['completed', 'pending'].includes(status) && (
          <Alert tone="bad" className="mt-4" title={`Payment ${status}`}>
            No money was taken for this attempt, or it was reversed. You can try again.
          </Alert>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <ButtonLink to="/app/billing" variant="secondary">
            Billing
          </ButtonLink>
          <Link to="/app" className="btn btn-md btn-primary">
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
