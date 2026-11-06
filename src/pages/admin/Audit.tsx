import { useState } from 'react';
import { Pagination, PageHeader, Spinner, useLoad } from '../../components/ui';
import { api } from '../../lib/api';
import { fmtDateTime } from '../../lib/format';
import { Table, Td } from './AdminLayout';

export default function Audit() {
  const [page, setPage] = useState(1);
  const { data, loading } = useLoad(() => api.get(`/admin/audit?page=${page}`), [page]);
  if (loading || !data) return <Spinner />;
  return (
    <>
      <PageHeader title="Audit log" subtitle="Sensitive actions with actor and time." />
      <Table head={['When', 'Actor', 'Action', 'Target', 'Detail']} empty={!data.entries.length}>
        {data.entries.map((e: any) => (
          <tr key={e.id}>
            <Td className="whitespace-nowrap">{fmtDateTime(e.created_at)}</Td>
            <Td>{e.actor_email ?? 'system'}</Td>
            <Td className="font-mono text-xs">{e.action}</Td>
            <Td className="text-xs">
              {e.target_type} {e.target_id}
            </Td>
            <Td className="max-w-xs break-words font-mono text-xs text-ink-500">
              {JSON.stringify(e.detail)}
            </Td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} pages={data.entries.length === 100 ? page + 1 : page} onPage={setPage} />
    </>
  );
}
