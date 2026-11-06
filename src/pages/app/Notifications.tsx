import { Bell, Settings } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, EmptyState, ErrorAlert, PageHeader, Spinner, cx, useLoad } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { relTime } from '../../lib/format';

export default function Notifications() {
  const { refresh } = useAuth();
  const nav = useNavigate();
  const { data, error, loading, reload } = useLoad(
    () => api.get<{ notifications: any[] }>('/notifications'),
    [],
  );
  return (
    <>
      <PageHeader
        title="Notifications"
        actions={
          <>
            <Link to="/app/settings" className="btn btn-md btn-outline">
              <Settings className="h-4 w-4" /> Alert settings
            </Link>
            <Button
              variant="secondary"
              onClick={async () => {
                await api.post('/notifications/read-all');
                reload();
                void refresh();
              }}
            >
              Mark all read
            </Button>
          </>
        }
      />
      <ErrorAlert error={error} />
      {loading ? (
        <Spinner />
      ) : data?.notifications.length ? (
        <ul className="card divide-y divide-ink-100">
          {data.notifications.map((n) => (
            <li key={n.id}>
              <button
                className={cx(
                  'flex w-full gap-3 px-5 py-4 text-left hover:bg-ink-50',
                  !n.read_at && 'bg-brand-50/40',
                )}
                onClick={async () => {
                  if (!n.read_at) await api.post(`/notifications/${n.id}/read`);
                  void refresh();
                  nav(n.link ?? '/app');
                }}
              >
                <span
                  className={cx(
                    'mt-1.5 h-2 w-2 flex-none rounded-full',
                    n.read_at ? 'bg-transparent' : 'bg-brand-500',
                  )}
                />
                <div className="min-w-0">
                  <p className={cx('text-[15px]', !n.read_at && 'font-semibold')}>{n.title}</p>
                  <p className="text-sm text-ink-500">{n.body}</p>
                  <p className="mt-1 text-xs text-ink-400">{relTime(n.created_at)}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<Bell className="h-10 w-10" />} title="You're all caught up">
          New matches, deadline reminders and status changes will appear here.
        </EmptyState>
      )}
    </>
  );
}
