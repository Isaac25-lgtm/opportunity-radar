import { useState } from 'react';
import { Button, ErrorAlert, PageHeader, Spinner, useConfirm, useLoad, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { fmtDate } from '../../lib/format';
import { useAuth } from '../../lib/auth';
import { StatusPill, Table, Td } from './AdminLayout';

export default function Users() {
  const { me } = useAuth();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const { data, loading, reload } = useLoad(
    () => api.get(`/admin/users?q=${encodeURIComponent(term)}`),
    [term],
  );
  const act = async (id: string, body: Record<string, string>, label: string) => {
    if (
      !(await confirm('Confirm change', `${label}?`, {
        confirm: 'Confirm',
        danger: body.status === 'suspended',
      }))
    )
      return;
    try {
      await api.patch(`/admin/users/${id}`, body);
      toast('Updated');
      reload();
    } catch (e) {
      setErr(e);
    }
  };
  return (
    <>
      {dialog}
      <PageHeader title="Users" />
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(q);
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="input max-w-sm"
          placeholder="Search name or email"
          aria-label="Search users"
        />
        <Button type="submit">Search</Button>
      </form>
      <ErrorAlert error={err} className="mb-4" />
      {loading ? (
        <Spinner />
      ) : (
        <Table
          head={['User', 'Role', 'Status', 'Profiles', 'Plan', 'Joined', '']}
          empty={!data?.users.length}
        >
          {data?.users.map((u: any) => (
            <tr key={u.id}>
              <Td>
                <p className="font-semibold">{u.name}</p>
                <p className="text-xs text-ink-500">{u.email}</p>
              </Td>
              <Td>{u.role}</Td>
              <Td>
                <StatusPill s={u.status} />
              </Td>
              <Td>{u.profiles}</Td>
              <Td>{u.plan ?? 'Free'}</Td>
              <Td>{fmtDate(u.created_at)}</Td>
              <Td className="space-x-1 whitespace-nowrap text-right">
                {u.id !== me.user?.id && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        act(
                          u.id,
                          { role: u.role === 'admin' ? 'user' : 'admin' },
                          u.role === 'admin'
                            ? `Remove admin role from ${u.email}`
                            : `Make ${u.email} an administrator`,
                        )
                      }
                    >
                      {u.role === 'admin' ? 'Revoke admin' : 'Make admin'}
                    </Button>
                    <Button
                      size="sm"
                      variant={u.status === 'active' ? 'danger' : 'secondary'}
                      onClick={() =>
                        act(
                          u.id,
                          { status: u.status === 'active' ? 'suspended' : 'active' },
                          u.status === 'active' ? `Suspend ${u.email}` : `Reactivate ${u.email}`,
                        )
                      }
                    >
                      {u.status === 'active' ? 'Suspend' : 'Reactivate'}
                    </Button>
                  </>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
