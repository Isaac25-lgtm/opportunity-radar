import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, ErrorAlert, Spinner, useLoad } from '../../components/ui';
import { api } from '../../lib/api';
import { ugx } from '../../lib/format';

/** Development-only payment simulator (the API refuses it in production). No money moves. */
export default function MockCheckout() {
  const { tracking } = useParams();
  const nav = useNavigate();
  const { data, error, loading } = useLoad(() => api.get(`/billing/mock/${tracking}`), [tracking]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  if (loading) return <Spinner />;
  const act = async (outcome: string) => {
    setBusy(true);
    try {
      const r = await api.post(`/billing/mock/${tracking}`, { outcome });
      nav(r.return_url);
    } catch (e) {
      setErr(e);
      setBusy(false);
    }
  };
  return (
    <section className="py-14">
      <div className="container-page max-w-md">
        <div className="card p-6">
          <Alert tone="warn" title="Payment simulator">
            This is a development test page. No real money is charged.
          </Alert>
          <ErrorAlert error={error || err} className="mt-4" />
          {data && (
            <>
              <h1 className="mt-5 text-xl font-bold">{data.payment.plan_name} plan</h1>
              <p className="text-2xl font-extrabold">{ugx(data.payment.amount)}</p>
              <div className="mt-6 grid gap-2">
                <Button loading={busy} onClick={() => act('completed')}>
                  Simulate successful payment
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => act('failed')}>
                  Simulate failed payment
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => act('cancelled')}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
