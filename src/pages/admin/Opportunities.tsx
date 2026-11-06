import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CATEGORY_LABELS } from '../../../shared/constants';
import { VerificationBadge, type OppSummary } from '../../components/opportunity';
import { Button, ErrorAlert, PageHeader, SelectInput, Spinner, useLoad, useToast } from '../../components/ui';
import { api, qs } from '../../lib/api';
import { fmtDate, relTime } from '../../lib/format';
import { StatusPill, Table, Td } from './AdminLayout';

export default function Opportunities() {
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const f = {
    moderation: sp.get('moderation') ?? '',
    status: sp.get('status') ?? '',
    verification: sp.get('verification') ?? '',
    stale: sp.get('stale') ?? '',
    q: sp.get('q') ?? '',
  };
  const [q, setQ] = useState(f.q);
  const [err, setErr] = useState<unknown>(null);
  const { data, loading, reload } = useLoad(() => api.get(`/admin/opportunities${qs(f)}`), [sp.toString()]);
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    setSp(n);
  };
  const mod = async (id: string, action: string) => {
    try {
      await api.post(`/admin/opportunities/${id}/moderate`, { action });
      toast(`Done: ${action}`);
      reload();
    } catch (e) {
      setErr(e);
    }
  };
  return (
    <>
      <PageHeader
        title="Opportunities"
        subtitle="Review, verify, correct and curate listings. Every change is audited."
        actions={
          <Link to="/admin/opportunities/new" className="btn btn-md btn-primary">
            <Plus className="h-4 w-4" /> Add curated opportunity
          </Link>
        }
      />
      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-5">
        <form
          className="sm:col-span-2"
          onSubmit={(e) => {
            e.preventDefault();
            set('q', q);
          }}
        >
          <label className="field-label" htmlFor="aq">
            Search
          </label>
          <input
            id="aq"
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Title, organisation, reference"
          />
        </form>
        <SelectInput
          label="Moderation"
          value={f.moderation}
          onChange={(e) => set('moderation', e.target.value)}
          placeholder="Any"
          options={['pending', 'approved', 'rejected'].map((v) => ({ value: v, label: v }))}
        />
        <SelectInput
          label="Status"
          value={f.status}
          onChange={(e) => set('status', e.target.value)}
          placeholder="Any"
          options={['open', 'closed', 'expired', 'cancelled', 'status_uncertain'].map((v) => ({
            value: v,
            label: v.replace('_', ' '),
          }))}
        />
        <SelectInput
          label="Verification"
          value={f.verification}
          onChange={(e) => set('verification', e.target.value)}
          placeholder="Any"
          options={[
            'verified_official',
            'verified_ats',
            'aggregator_only',
            'admin_verified',
            'unverified',
          ].map((v) => ({ value: v, label: v.replace('_', ' ') }))}
        />
        <label className="flex items-center gap-2 text-sm font-medium sm:col-span-5">
          <input
            type="checkbox"
            checked={f.stale === '1'}
            onChange={(e) => set('stale', e.target.checked ? '1' : '')}
          />{' '}
          Only open listings not checked in 72h (stale)
        </label>
      </div>
      <ErrorAlert error={err} className="mb-4" />
      {loading || !data ? (
        <Spinner />
      ) : (
        <Table
          head={['Opportunity', 'Category', 'State', 'Deadline', 'Checked', '']}
          empty={!data.items.length}
        >
          {data.items.map((o: OppSummary & { moderation: string }) => (
            <tr key={o.id}>
              <Td>
                <Link to={`/admin/opportunities/${o.id}`} className="font-semibold hover:text-brand-600">
                  {o.title}
                </Link>
                <p className="text-xs text-ink-500">
                  {o.organization} · {o.source.name}
                </p>
              </Td>
              <Td>{CATEGORY_LABELS[o.category]}</Td>
              <Td>
                <div className="flex flex-col items-start gap-1">
                  <VerificationBadge state={o.display_state} />
                  <StatusPill s={o.moderation} />
                </div>
              </Td>
              <Td>{fmtDate(o.deadline_at)}</Td>
              <Td>{relTime(o.last_checked_at)}</Td>
              <Td className="space-y-1 whitespace-nowrap text-right">
                {o.verification !== 'admin_verified' && o.verification !== 'verified_official' && (
                  <Button size="sm" variant="secondary" onClick={() => mod(o.id, 'verify')}>
                    Verify
                  </Button>
                )}{' '}
                {o.moderation !== 'approved' ? (
                  <Button size="sm" variant="outline" onClick={() => mod(o.id, 'approve')}>
                    Approve
                  </Button>
                ) : (
                  <Button size="sm" variant="danger" onClick={() => mod(o.id, 'reject')}>
                    Reject
                  </Button>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
