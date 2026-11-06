import { useState } from 'react';
import { ENTITLEMENT_LABELS, type Entitlements } from '../../../shared/entitlements';
import {
  Button,
  ChipSelect,
  ErrorAlert,
  PageHeader,
  Spinner,
  TextInput,
  Toggle,
  useLoad,
  useToast,
} from '../../components/ui';
import { api } from '../../lib/api';

export default function Plans() {
  const { data, loading, reload } = useLoad(() => api.get('/admin/plans'), []);
  if (loading || !data) return <Spinner />;
  return (
    <>
      <PageHeader
        title="Plans & entitlements"
        subtitle="Prices and limits are enforced server-side. -1 means unlimited."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        {data.plans.map((p: any) => (
          <PlanCard key={p.code} p={p} onSaved={reload} />
        ))}
      </div>
    </>
  );
}

function PlanCard({ p, onSaved }: { p: any; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    name: p.name,
    description: p.description,
    price_ugx: p.price_ugx,
    active: !!p.active,
    entitlements: p.entitlements as Entitlements,
  });
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const setE = (k: keyof Entitlements, v: unknown) =>
    setF({ ...f, entitlements: { ...f.entitlements, [k]: v } });
  return (
    <section className="card space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{p.code}</h2>
        <Toggle label="Active" checked={f.active} onChange={(v) => setF({ ...f, active: v })} />
      </div>
      <ErrorAlert error={err} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextInput label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <TextInput
          label="Price (UGX / month)"
          type="number"
          min={0}
          value={f.price_ugx}
          onChange={(e) => setF({ ...f, price_ugx: Number(e.target.value) })}
          disabled={p.code === 'free'}
        />
        <TextInput
          className="sm:col-span-2"
          label="Description"
          value={f.description}
          onChange={(e) => setF({ ...f, description: e.target.value })}
        />
        {(Object.keys(ENTITLEMENT_LABELS) as Array<keyof Entitlements>).map((k) => {
          const v = f.entitlements[k];
          if (typeof v === 'boolean')
            return <Toggle key={k} label={ENTITLEMENT_LABELS[k]} checked={v} onChange={(x) => setE(k, x)} />;
          if (Array.isArray(v))
            return (
              <div key={k} className="sm:col-span-2">
                <ChipSelect
                  label={ENTITLEMENT_LABELS[k]}
                  value={v}
                  onChange={(x) => setE(k, x)}
                  options={['instant', 'daily', 'weekly'].map((x) => ({ value: x as 'instant', label: x }))}
                />
              </div>
            );
          return (
            <TextInput
              key={k}
              label={ENTITLEMENT_LABELS[k]}
              type="number"
              min={-1}
              value={v}
              onChange={(e) => setE(k, Number(e.target.value))}
            />
          );
        })}
      </div>
      <Button
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            await api.put(`/admin/plans/${p.code}`, f);
            toast('Plan saved');
            onSaved();
          } catch (e) {
            setErr(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        Save plan
      </Button>
    </section>
  );
}
