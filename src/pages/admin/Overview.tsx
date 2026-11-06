import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORY_LABELS } from '../../../shared/constants';
import { Button, ErrorAlert, PageHeader, Spinner, useLoad, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { fmtDateTime, relTime } from '../../lib/format';
import { StatusPill } from './AdminLayout';

export default function Overview() {
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(() => api.get('/admin/metrics'), []);
  const msgs = useLoad(() => api.get('/admin/messages'), []);
  const [busy, setBusy] = useState(false);
  if (loading) return <Spinner />;
  if (!data) return <ErrorAlert error={error} />;
  const stats: Array<[string, number, string?]> = [
    ['Users', data.users, '/admin/users'],
    ['Profiles', data.profiles],
    ['Open opportunities', data.open_opportunities, '/admin/opportunities'],
    ['All opportunities', data.total_opportunities],
    ['Enabled sources', data.enabled_sources, '/admin/sources'],
    ['Pending moderation', data.pending_moderation, '/admin/opportunities?moderation=pending'],
    ['Stored matches', data.matches],
    ['Notifications', data.notifications],
    ['Emails sent', data.deliveries_sent],
    ['Email failures', data.deliveries_failed],
    ['Active subscriptions', data.active_subscriptions, '/admin/payments'],
    ['Completed payments', data.completed_payments, '/admin/payments'],
  ];
  return (
    <>
      <PageHeader
        title="Admin overview"
        actions={
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await api.post('/admin/runs', {});
                toast(
                  r.started
                    ? `Run started (${r.tasks} sources)`
                    : `Not started: ${r.reason?.replace(/_/g, ' ')}`,
                  r.started ? 'ok' : 'info',
                );
                reload();
              } finally {
                setBusy(false);
              }
            }}
          >
            Run discovery now
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {stats.map(([l, n, to]) => {
          const inner = (
            <>
              <p className="text-xs font-semibold uppercase text-ink-500">{l}</p>
              <p className="mt-1 text-2xl font-bold">{Number(n).toLocaleString()}</p>
            </>
          );
          return to ? (
            <Link key={l} to={to} className="card p-4 hover:shadow-paper">
              {inner}
            </Link>
          ) : (
            <div key={l} className="card p-4">
              {inner}
            </div>
          );
        })}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-bold">Open opportunities by category</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {data.by_category.map((c: any) => (
              <li key={c.category} className="flex justify-between">
                <span>{CATEGORY_LABELS[c.category as keyof typeof CATEGORY_LABELS] ?? c.category}</span>
                <span className="font-semibold">{c.n}</span>
              </li>
            ))}
            {!data.by_category.length && <li className="text-ink-500">None yet — run discovery.</li>}
          </ul>
          <h2 className="mt-5 font-bold">By verification</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {data.by_verification.map((c: any) => (
              <li key={c.verification} className="flex justify-between">
                <span>{c.verification.replace(/_/g, ' ')}</span>
                <span className="font-semibold">{c.n}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Recent ingestion runs</h2>
            <Link to="/admin/runs" className="text-sm font-semibold text-brand-600">
              All runs
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-ink-100 text-sm">
            {data.recent_runs.map((r: any) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                <div>
                  <p className="font-semibold">{fmtDateTime(r.started_at)}</p>
                  <p className="text-xs text-ink-500">
                    {r.trigger} · {r.sources_done}/{r.sources_total} sources · {r.items_new} new ·{' '}
                    {r.items_updated} updated
                  </p>
                </div>
                <StatusPill s={r.status} />
              </li>
            ))}
            {!data.recent_runs.length && <li className="py-2 text-ink-500">No runs yet.</li>}
          </ul>
        </section>
      </div>
      <section className="card mt-6 p-5">
        <h2 className="font-bold">Contact messages</h2>
        <ul className="mt-3 divide-y divide-ink-100 text-sm">
          {(msgs.data?.messages ?? []).map((m: any) => (
            <li key={m.id} className="py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">
                  {m.name} ·{' '}
                  <a className="text-brand-600" href={`mailto:${m.email}`}>
                    {m.email}
                  </a>{' '}
                  · {m.topic}
                </p>
                {m.status === 'new' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await api.post(`/admin/messages/${m.id}/handled`);
                      msgs.reload();
                    }}
                  >
                    Mark handled
                  </Button>
                ) : (
                  <StatusPill s="handled" />
                )}
              </div>
              <p className="mt-1 whitespace-pre-line text-ink-700">{m.message}</p>
              <p className="text-xs text-ink-400">{relTime(m.created_at)}</p>
            </li>
          ))}
          {!msgs.data?.messages.length && <li className="text-ink-500">No messages.</li>}
        </ul>
      </section>
    </>
  );
}
