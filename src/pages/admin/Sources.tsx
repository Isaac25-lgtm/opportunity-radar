import { Play, Plus } from 'lucide-react';
import { useState } from 'react';
import { OPPORTUNITY_CATEGORIES } from '../../../shared/constants';
import {
  Button,
  ErrorAlert,
  Modal,
  PageHeader,
  SelectInput,
  Spinner,
  TagInput,
  TextArea,
  TextInput,
  Toggle,
  useLoad,
  useToast,
} from '../../components/ui';
import { api } from '../../lib/api';
import { relTime } from '../../lib/format';
import { StatusPill, Table, Td } from './AdminLayout';

const BLANK = {
  slug: '',
  name: '',
  owner: '',
  website: '',
  source_type: 'official',
  connector: 'rss',
  config: { url: '' },
  categories: [],
  geography: ['Uganda'],
  access_method: '',
  terms_url: '',
  automation: 'automated',
  enabled: false,
  refresh_minutes: 360,
  rate_limit_per_hour: 4,
  verification_policy: '',
  notes: '',
};

export default function Sources() {
  const toast = useToast();
  const { data, loading, reload } = useLoad(() => api.get('/admin/sources'), []);
  const [edit, setEdit] = useState<any>(null);
  const [err, setErr] = useState<unknown>(null);
  const runOne = async (id: string) => {
    setErr(null);
    try {
      const r = await api.post('/admin/runs', { source_ids: [id] });
      toast(
        r.started ? 'Run started' : `Not started: ${String(r.reason).replace(/_/g, ' ')}`,
        r.started ? 'ok' : 'info',
      );
      reload();
    } catch (e) {
      setErr(e);
    }
  };
  return (
    <>
      <PageHeader
        title="Opportunity sources"
        subtitle="Only add official portals, documented APIs/feeds or permitted partner feeds. Record the terms and access method."
        actions={
          <Button onClick={() => setEdit({ ...BLANK })}>
            <Plus className="h-4 w-4" /> Add source
          </Button>
        }
      />
      <ErrorAlert error={err} className="mb-4" />
      {loading || !data ? (
        <Spinner />
      ) : (
        <Table head={['Source', 'Type / connector', 'Health', 'Items', 'Enabled', '']}>
          {data.sources.map((s: any) => (
            <tr key={s.id}>
              <Td>
                <p className="font-semibold">{s.name}</p>
                <p className="text-xs text-ink-500">
                  {s.owner} · every {Math.round(s.refresh_minutes / 60)}h
                </p>
                {s.notes && <p className="mt-1 max-w-sm text-xs text-ink-400">{s.notes}</p>}
              </Td>
              <Td>
                <p>{s.source_type}</p>
                <p className="text-xs text-ink-500">
                  {s.connector} · {s.automation}
                </p>
              </Td>
              <Td>
                <p className="text-xs">Last success: {relTime(s.last_success_at)}</p>
                <p className="text-xs text-ink-500">Last attempt: {relTime(s.last_attempt_at)}</p>
                {s.consecutive_failures > 0 && <StatusPill s={`${s.consecutive_failures} failures`} />}
                {s.last_error && <p className="mt-1 max-w-xs text-xs text-bad-700">{s.last_error}</p>}
              </Td>
              <Td>
                {s.open_items} open
                <p className="text-xs text-ink-500">{s.records} records</p>
              </Td>
              <Td>
                <Toggle
                  label=""
                  checked={!!s.enabled}
                  onChange={async (v) => {
                    await api.post(`/admin/sources/${s.id}/toggle`, { enabled: v });
                    reload();
                  }}
                />
              </Td>
              <Td className="whitespace-nowrap text-right">
                {s.connector !== 'manual' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runOne(s.id)}
                    aria-label={`Run ${s.name} now`}
                  >
                    <Play className="h-3.5 w-3.5" /> Run
                  </Button>
                )}{' '}
                <Button size="sm" variant="secondary" onClick={() => setEdit({ ...s, enabled: !!s.enabled })}>
                  Edit
                </Button>
              </Td>
            </tr>
          ))}
        </Table>
      )}
      {edit && (
        <SourceModal
          s={edit}
          connectors={data?.connectors ?? []}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function SourceModal({
  s,
  connectors,
  onClose,
  onSaved,
}: {
  s: any;
  connectors: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<any>(s);
  const [cfg, setCfg] = useState(JSON.stringify(s.config ?? {}, null, 2));
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: unknown) => setF({ ...f, [k]: v });
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={s.id ? `Edit ${s.name}` : 'Add source'}
      footer={
        <Button
          loading={busy}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              const config = JSON.parse(cfg || '{}');
              const payload = {
                slug: f.slug,
                name: f.name,
                owner: f.owner,
                website: f.website,
                source_type: f.source_type,
                connector: f.connector,
                config,
                categories: f.categories,
                geography: f.geography,
                access_method: f.access_method,
                terms_url: f.terms_url || null,
                automation: f.automation,
                enabled: !!f.enabled,
                refresh_minutes: Number(f.refresh_minutes),
                rate_limit_per_hour: Number(f.rate_limit_per_hour),
                verification_policy: f.verification_policy,
                notes: f.notes || null,
              };
              if (s.id) await api.put(`/admin/sources/${s.id}`, payload);
              else await api.post('/admin/sources', payload);
              onSaved();
            } catch (e) {
              setErr(e instanceof SyntaxError ? new Error('Config must be valid JSON.') : e);
            } finally {
              setBusy(false);
            }
          }}
        >
          Save source
        </Button>
      }
    >
      <ErrorAlert error={err} className="mb-4" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput label="Name" value={f.name} onChange={(e) => set('name', e.target.value)} />
        <TextInput
          label="Slug"
          value={f.slug}
          onChange={(e) => set('slug', e.target.value)}
          hint="lowercase-with-dashes"
        />
        <TextInput label="Owner" value={f.owner} onChange={(e) => set('owner', e.target.value)} />
        <TextInput
          label="Official website"
          value={f.website}
          onChange={(e) => set('website', e.target.value)}
        />
        <SelectInput
          label="Source type"
          value={f.source_type}
          onChange={(e) => set('source_type', e.target.value)}
          options={['official', 'ats', 'aggregator', 'partner', 'curated'].map((v) => ({
            value: v,
            label: v,
          }))}
        />
        <SelectInput
          label="Connector"
          value={f.connector}
          onChange={(e) => set('connector', e.target.value)}
          options={connectors.map((v) => ({ value: v, label: v }))}
        />
        <SelectInput
          label="Automation"
          value={f.automation}
          onChange={(e) => set('automation', e.target.value)}
          options={['automated', 'partial', 'curated'].map((v) => ({ value: v, label: v }))}
        />
        <TextInput
          label="Refresh (minutes)"
          type="number"
          value={f.refresh_minutes}
          onChange={(e) => set('refresh_minutes', e.target.value)}
        />
        <TextInput
          label="Access method"
          className="sm:col-span-2"
          value={f.access_method}
          onChange={(e) => set('access_method', e.target.value)}
          hint="e.g. Public RSS feed at …, documented API …"
        />
        <TextInput
          label="Terms of use URL"
          value={f.terms_url ?? ''}
          onChange={(e) => set('terms_url', e.target.value)}
        />
        <TextInput
          label="Rate limit (requests/hour)"
          type="number"
          value={f.rate_limit_per_hour}
          onChange={(e) => set('rate_limit_per_hour', e.target.value)}
        />
        <div className="sm:col-span-2">
          <TagInput
            label="Categories"
            value={f.categories}
            onChange={(v) =>
              set(
                'categories',
                v.filter((x) => (OPPORTUNITY_CATEGORIES as readonly string[]).includes(x)),
              )
            }
            suggestions={[...OPPORTUNITY_CATEGORIES]}
          />
        </div>
        <div className="sm:col-span-2">
          <TagInput label="Geography" value={f.geography} onChange={(v) => set('geography', v)} />
        </div>
        <TextArea
          className="sm:col-span-2"
          label="Connector config (JSON)"
          value={cfg}
          onChange={(e) => setCfg(e.target.value)}
          hint='rss/json: {"url": "https://…", "category": "job"} · lever: {"company": "slug", "employer_name": "…"} · greenhouse: {"board": "token"}'
        />
        <TextArea
          className="sm:col-span-2"
          label="Verification policy"
          rows={2}
          value={f.verification_policy}
          onChange={(e) => set('verification_policy', e.target.value)}
        />
        <TextArea
          className="sm:col-span-2"
          label="Notes"
          rows={2}
          value={f.notes ?? ''}
          onChange={(e) => set('notes', e.target.value)}
        />
        <Toggle label="Enabled" checked={!!f.enabled} onChange={(v) => set('enabled', v)} />
      </div>
    </Modal>
  );
}
