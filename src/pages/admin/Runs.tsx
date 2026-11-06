import { useState } from 'react';
import { Button, ErrorAlert, Modal, PageHeader, Spinner, useLoad, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { fmtDateTime } from '../../lib/format';
import { StatusPill, Table, Td } from './AdminLayout';

export default function Runs() {
  const toast = useToast();
  const { data, loading, reload } = useLoad(() => api.get('/admin/runs'), []);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const act = async (key: string, fn: () => Promise<any>, msg: (r: any) => string) => {
    setBusy(key);
    setErr(null);
    try {
      const r = await fn();
      toast(msg(r));
      reload();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      <PageHeader
        title="Ingestion runs"
        subtitle={
          data
            ? `Schedule: every ${data.schedule.interval_hours} hours. Scheduler tick: ${data.schedule.cron}.`
            : undefined
        }
        actions={
          <>
            <Button
              variant="secondary"
              loading={busy === 'drain'}
              onClick={() =>
                act(
                  'drain',
                  () => api.post('/admin/drain'),
                  (r) => `Processed ${r.processed.length} task(s)`,
                )
              }
            >
              Process queued tasks
            </Button>
            <Button
              loading={busy === 'run'}
              onClick={() =>
                act(
                  'run',
                  () => api.post('/admin/runs', {}),
                  (r) =>
                    r.started
                      ? `Run started (${r.tasks} sources)`
                      : `Not started: ${String(r.reason).replace(/_/g, ' ')}`,
                )
              }
            >
              Run now
            </Button>
          </>
        }
      />
      <ErrorAlert error={err} className="mb-4" />
      {loading || !data ? (
        <Spinner />
      ) : (
        <Table
          head={['Started', 'Trigger', 'Status', 'Sources', 'Items', 'Finished', '']}
          empty={!data.runs.length}
        >
          {data.runs.map((r: any) => (
            <tr key={r.id}>
              <Td>{fmtDateTime(r.started_at)}</Td>
              <Td>{r.trigger}</Td>
              <Td>
                <StatusPill s={r.status} />
              </Td>
              <Td>
                {r.sources_done}/{r.sources_total}
                {r.sources_failed > 0 && <span className="text-bad-700"> · {r.sources_failed} failed</span>}
              </Td>
              <Td>
                {r.items_seen} seen · {r.items_new} new · {r.items_updated} updated
              </Td>
              <Td>{r.finished_at ? fmtDateTime(r.finished_at) : '—'}</Td>
              <Td className="text-right">
                <Button size="sm" variant="outline" onClick={() => setOpen(r.id)}>
                  Details
                </Button>
              </Td>
            </tr>
          ))}
        </Table>
      )}
      {open && <RunModal id={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </>
  );
}

function RunModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { data, loading, reload } = useLoad(() => api.get(`/admin/runs/${id}`), [id]);
  return (
    <Modal open wide onClose={onClose} title="Run details">
      {loading || !data ? (
        <Spinner />
      ) : (
        <ul className="divide-y divide-ink-100">
          {data.tasks.map((t: any) => (
            <li key={t.id} className="py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{t.source_name}</p>
                <StatusPill s={t.status} />
              </div>
              <p className="text-xs text-ink-500">
                Attempts {t.attempts}/{t.max_attempts} · {t.items_seen} seen · {t.items_new} new ·{' '}
                {t.items_updated} updated
                {t.status === 'pending' && ` · next attempt ${fmtDateTime(t.next_attempt_at)}`}
              </p>
              {t.last_error && <p className="mt-1 text-xs text-bad-700">{t.last_error}</p>}
              {t.status === 'dead' && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  onClick={async () => {
                    await api.post(`/admin/tasks/${t.id}/retry`);
                    reload();
                    onChanged();
                  }}
                >
                  Retry
                </Button>
              )}
            </li>
          ))}
          {!data.tasks.length && <li className="py-3 text-sm text-ink-500">No source tasks in this run.</li>}
        </ul>
      )}
    </Modal>
  );
}
