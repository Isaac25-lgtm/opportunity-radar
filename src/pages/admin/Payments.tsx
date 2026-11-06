import { PageHeader, Spinner, useLoad } from '../../components/ui';
import { api } from '../../lib/api';
import { fmtDate, fmtDateTime, ugx } from '../../lib/format';
import { StatusPill, Table, Td } from './AdminLayout';

export default function Payments() {
  const { data, loading } = useLoad(() => api.get('/admin/payments'), []);
  if (loading || !data) return <Spinner />;
  return (
    <>
      <PageHeader
        title="Payments & subscriptions"
        subtitle="Subscriptions activate only after a server-side status check with the provider."
      />
      <h2 className="mb-2 font-bold">Payments</h2>
      <Table
        head={['Created', 'User', 'Plan', 'Amount', 'Provider', 'Status', 'Reference']}
        empty={!data.payments.length}
      >
        {data.payments.map((p: any) => (
          <tr key={p.id}>
            <Td>{fmtDateTime(p.created_at)}</Td>
            <Td>{p.email}</Td>
            <Td>{p.plan_name}</Td>
            <Td>{ugx(p.amount)}</Td>
            <Td>{p.provider}</Td>
            <Td>
              <StatusPill s={p.status} />
              {p.status_detail && (
                <p className="mt-1 max-w-[200px] text-xs text-ink-500">{p.status_detail}</p>
              )}
            </Td>
            <Td className="font-mono text-xs">{p.merchant_reference}</Td>
          </tr>
        ))}
      </Table>
      <h2 className="mb-2 mt-8 font-bold">Subscriptions</h2>
      <Table head={['User', 'Plan', 'Status', 'Period end']} empty={!data.subscriptions.length}>
        {data.subscriptions.map((s: any) => (
          <tr key={s.id}>
            <Td>{s.email}</Td>
            <Td>{s.plan_name}</Td>
            <Td>
              <StatusPill s={s.status} />
            </Td>
            <Td>{fmtDate(s.current_period_end)}</Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
