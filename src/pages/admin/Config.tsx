import { CheckCircle2, XCircle } from 'lucide-react';
import { useState } from 'react';
import {
  Alert,
  Button,
  ErrorAlert,
  PageHeader,
  Spinner,
  TextArea,
  TextInput,
  Toggle,
  useLoad,
  useToast,
} from '../../components/ui';
import { api } from '../../lib/api';
import { relTime } from '../../lib/format';

const LABELS: Record<string, string> = {
  'ingestion.interval_hours': 'Discovery interval (hours)',
  'ingestion.max_tasks_per_tick': 'Sources processed per scheduler tick',
  'ingestion.stale_after_hours': 'Mark automated listings stale after (hours)',
  'ingestion.missing_runs_before_uncertain': 'Missing complete-listing runs before "status uncertain"',
  'alerts.min_score_default': 'Default minimum alert score',
  'matching.weights': 'Matching weight overrides (JSON)',
  'payments.enabled': 'Enable live checkout (requires provider credentials)',
};

export default function Config() {
  const { data, loading, reload } = useLoad(() => api.get('/admin/config'), []);
  if (loading || !data) return <Spinner />;
  return (
    <>
      <PageHeader
        title="Configuration"
        subtitle={`Environment: ${data.environment_name}. Routine settings are editable here without a deploy.`}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-5 p-5">
          {data.config.map((c: any) => (
            <ConfigRow key={c.key} c={c} onSaved={reload} />
          ))}
        </section>
        <section className="card p-5">
          <h2 className="font-bold">Environment &amp; integrations</h2>
          <p className="mt-1 text-xs text-ink-500">Names only — values are never shown.</p>
          <ul className="mt-3 divide-y divide-ink-100 text-sm">
            {data.environment.map((e: any) => (
              <li key={e.name} className="flex items-start gap-2 py-2">
                {e.present ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-ok-500" />
                ) : (
                  <XCircle
                    className={`mt-0.5 h-4 w-4 flex-none ${e.required ? 'text-bad-500' : 'text-ink-300'}`}
                  />
                )}
                <div>
                  <p className="font-mono text-xs font-semibold">{e.name}</p>
                  <p className="text-xs text-ink-500">
                    {e.purpose}
                    {e.required && !e.present && (
                      <span className="font-semibold text-bad-700"> · required</span>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function ConfigRow({ c, onSaved }: { c: any; onSaved: () => void }) {
  const toast = useToast();
  const isJson = typeof c.value === 'object';
  const [v, setV] = useState<any>(isJson ? JSON.stringify(c.value, null, 2) : c.value);
  const [err, setErr] = useState<unknown>(null);
  const save = async (val: unknown) => {
    setErr(null);
    try {
      await api.put(`/admin/config/${encodeURIComponent(c.key)}`, { value: val });
      toast('Saved');
      onSaved();
    } catch (e) {
      setErr(e);
    }
  };
  return (
    <div>
      <ErrorAlert error={err} className="mb-2" />
      {typeof c.value === 'boolean' ? (
        <Toggle
          label={LABELS[c.key] ?? c.key}
          checked={!!v}
          onChange={(x) => {
            setV(x);
            void save(x);
          }}
        />
      ) : isJson ? (
        <>
          <TextArea
            label={LABELS[c.key] ?? c.key}
            rows={5}
            value={v}
            onChange={(e) => setV(e.target.value)}
            hint='e.g. {"career": {"skills": 40, "role": 20}}'
          />
          <Button
            size="sm"
            className="mt-2"
            onClick={() => {
              try {
                void save(JSON.parse(v || '{}'));
              } catch {
                setErr(new Error('Invalid JSON'));
              }
            }}
          >
            Save
          </Button>
        </>
      ) : (
        <div className="flex items-end gap-2">
          <TextInput
            className="flex-1"
            label={LABELS[c.key] ?? c.key}
            type="number"
            value={v}
            onChange={(e) => setV(e.target.value)}
          />
          <Button size="md" variant="secondary" onClick={() => save(Number(v))}>
            Save
          </Button>
        </div>
      )}
      <p className="mt-1 text-xs text-ink-400">Updated {relTime(c.updated_at)}</p>
      {c.key === 'payments.enabled' && (
        <Alert tone="info" className="mt-2">
          Pesapal checkout stays disabled until merchant credentials are set as secrets and this switch is on.
        </Alert>
      )}
    </div>
  );
}
