import {
  Activity,
  Cog,
  CreditCard,
  Database,
  FileSearch,
  Gauge,
  Layers,
  ScrollText,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { AppHeader } from '../../components/Layout';
import { cx } from '../../components/ui';

const NAV = [
  { to: '/admin', label: 'Overview', icon: Gauge, end: true },
  { to: '/admin/opportunities', label: 'Opportunities', icon: FileSearch },
  { to: '/admin/sources', label: 'Sources', icon: Database },
  { to: '/admin/runs', label: 'Ingestion runs', icon: Activity },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/plans', label: 'Plans', icon: Layers },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard },
  { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
  { to: '/admin/config', label: 'Configuration', icon: Cog },
];

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-ink-50">
      <AppHeader />
      <div className="container-page grid gap-6 py-6 lg:grid-cols-[220px_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Admin">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-2 whitespace-nowrap rounded px-3 py-2 text-sm font-semibold',
                  isActive ? 'bg-brand-500 text-white' : 'text-ink-600 hover:bg-white',
                )
              }
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </NavLink>
          ))}
        </nav>
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function Table({
  head,
  children,
  empty,
}: {
  head: ReactNode[];
  children: ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-ink-50 text-left text-xs uppercase tracking-wider text-ink-500">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">{children}</tbody>
      </table>
      {empty && <p className="p-6 text-center text-sm text-ink-500">Nothing to show.</p>}
    </div>
  );
}

export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <td className={cx('px-4 py-3 align-top', className)}>{children}</td>
);

export function StatusPill({ s }: { s: string }) {
  const tone = /completed$|active|approved|sent|done|open|verified/.test(s)
    ? 'bg-ok-50 text-ok-700'
    : /fail|dead|reject|suspend|cancel|error|revoked/.test(s)
      ? 'bg-bad-50 text-bad-700'
      : /running|pending|with_errors|uncertain/.test(s)
        ? 'bg-warn-50 text-warn-700'
        : 'bg-ink-100 text-ink-600';
  return <span className={cx('chip', tone)}>{s.replace(/_/g, ' ')}</span>;
}
