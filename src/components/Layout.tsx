import {
  Bell,
  Briefcase,
  ChevronDown,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  Radar,
  Settings,
  Shield,
  User,
  Wallet,
  X,
  ListChecks,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { initials } from '../lib/format';
import { ButtonLink, Spinner, cx } from './ui';

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <Link to="/" className={cx('flex items-center gap-2', className)} aria-label="Opportunity Radar home">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-white">
        <Radar className="h-5 w-5" aria-hidden />
      </span>
      <span className={cx('text-[19px] font-extrabold tracking-tight', light ? 'text-white' : 'text-ink')}>
        Opportunity<span className="text-brand-500">Radar</span>
      </span>
    </Link>
  );
}

const PUBLIC_NAV = [
  { to: '/cv-builder', label: 'CV Builder' },
  { to: '/opportunities', label: 'Opportunities' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/help', label: 'Help' },
];

export function PublicHeader() {
  const { me } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [loc.pathname]);
  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/95 backdrop-blur">
      <div className="container-page flex h-[72px] items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {PUBLIC_NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cx(
                  'rounded px-3 py-2 text-[15px] font-medium hover:text-brand-600',
                  isActive ? 'text-brand-600' : 'text-ink-700',
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          {me.user ? (
            <ButtonLink to="/app">My dashboard</ButtonLink>
          ) : (
            <>
              <Link
                to="/signin"
                className="rounded px-3 py-2 text-[15px] font-semibold text-ink-700 hover:text-brand-600"
              >
                Sign in
              </Link>
              <ButtonLink to="/signup">Get started</ButtonLink>
            </>
          )}
        </div>
        <button
          className="rounded p-2 text-ink-700 lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-ink-100 bg-white lg:hidden">
          <nav className="container-page flex flex-col py-3" aria-label="Mobile">
            {PUBLIC_NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="rounded px-2 py-3 text-base font-medium text-ink-700 hover:bg-ink-50"
              >
                {n.label}
              </Link>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2 pb-2">
              {me.user ? (
                <ButtonLink to="/app" className="col-span-2">
                  My dashboard
                </ButtonLink>
              ) : (
                <>
                  <ButtonLink to="/signin" variant="outline">
                    Sign in
                  </ButtonLink>
                  <ButtonLink to="/signup">Get started</ButtonLink>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

export function PublicFooter() {
  const cols: Array<[string, Array<[string, string]>]> = [
    [
      'Product',
      [
        ['CV Builder', '/cv-builder'],
        ['CV templates', '/templates'],
        ['Opportunities', '/opportunities'],
        ['Pricing', '/pricing'],
      ],
    ],
    [
      'For you',
      [
        ['Job seekers', '/how-it-works#career'],
        ['Students & researchers', '/how-it-works#academic'],
        ['Businesses', '/how-it-works#business'],
        ['Our sources', '/sources'],
      ],
    ],
    [
      'Support',
      [
        ['Help centre', '/help'],
        ['Contact us', '/contact'],
        ['Privacy policy', '/privacy'],
        ['Terms of use', '/terms'],
      ],
    ],
  ];
  return (
    <footer className="bg-ink text-ink-300">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo light />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-300">
            One profile for jobs, scholarships, grants and tenders — matched honestly from official and
            verified sources around the world.
          </p>
        </div>
        {cols.map(([title, links]) => (
          <div key={title}>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">{title}</h3>
            <ul className="mt-4 space-y-2.5">
              {links.map(([l, to]) => (
                <li key={to}>
                  <Link to={to} className="text-sm hover:text-white">
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-ink-400 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Opportunity Radar.</p>
          <p>We never guarantee selection. Always confirm requirements on the official notice.</p>
        </div>
      </div>
    </footer>
  );
}

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>
      <PublicHeader />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}

/* ---------------- App shell ---------------- */
const APP_NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/opportunities', label: 'Opportunities', icon: Radar },
  { to: '/app/cvs', label: 'CVs', icon: FileText },
  { to: '/app/tracker', label: 'Tracker', icon: ListChecks },
  { to: '/app/profiles', label: 'Profiles', icon: User },
];

function UserMenu() {
  const { me, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  useEffect(() => {
    const f = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', f);
    return () => document.removeEventListener('mousedown', f);
  }, []);
  if (!me.user) return null;
  const items: Array<[string, string, typeof User]> = [
    ['Saved opportunities', '/app/saved', Briefcase],
    ['Documents', '/app/documents', FolderOpen],
    ['Billing & plan', '/app/billing', Wallet],
    ['Settings', '/app/settings', Settings],
  ];
  if (me.user.role === 'admin') items.push(['Admin console', '/admin', Shield]);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full p-1 pr-2 hover:bg-ink-100"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
          {initials(me.user.name)}
        </span>
        <ChevronDown className="h-4 w-4 text-ink-500" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 overflow-hidden rounded-lg bg-white py-1 shadow-paper ring-1 ring-ink-100"
        >
          <div className="border-b border-ink-100 px-4 py-3">
            <p className="truncate text-sm font-semibold">{me.user.name}</p>
            <p className="truncate text-xs text-ink-500">{me.user.email}</p>
            <p className="mt-1 text-xs font-semibold text-brand-600">{me.plan?.name ?? 'Free'} plan</p>
          </div>
          {items.map(([l, to, Icon]) => (
            <Link
              key={to}
              to={to}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-50"
            >
              <Icon className="h-4 w-4 text-ink-400" /> {l}
            </Link>
          ))}
          <button
            role="menuitem"
            onClick={async () => {
              await signOut();
              nav('/');
            }}
            className="flex w-full items-center gap-3 border-t border-ink-100 px-4 py-2.5 text-left text-sm text-ink-700 hover:bg-ink-50"
          >
            <LogOut className="h-4 w-4 text-ink-400" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function AppHeader() {
  const { me } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [loc.pathname]);
  return (
    <header className="no-print sticky top-0 z-40 border-b border-ink-100 bg-white">
      <div className="container-page flex h-16 items-center justify-between gap-3">
        <div className="flex items-center gap-6">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="App">
            {APP_NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cx(
                    'rounded px-3 py-2 text-[15px] font-medium',
                    isActive ? 'bg-brand-50 text-brand-600' : 'text-ink-600 hover:text-ink',
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-1">
          <Link
            to="/app/notifications"
            className="relative rounded-full p-2 text-ink-600 hover:bg-ink-100"
            aria-label={`Notifications${me.unread ? ` (${me.unread} unread)` : ''}`}
          >
            <Bell className="h-5 w-5" />
            {!!me.unread && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-bad-500 px-1 text-[10px] font-bold text-white">
                {me.unread > 9 ? '9+' : me.unread}
              </span>
            )}
          </Link>
          <UserMenu />
          <button
            className="rounded p-2 text-ink-700 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={open}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-ink-100 bg-white md:hidden" aria-label="App mobile">
          <div className="container-page grid grid-cols-2 gap-1 py-3">
            {APP_NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cx(
                    'flex items-center gap-2 rounded px-3 py-3 text-[15px] font-medium',
                    isActive ? 'bg-brand-50 text-brand-600' : 'text-ink-700',
                  )
                }
              >
                <n.icon className="h-4 w-4" /> {n.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}

export function RequireAuth({ children, admin }: { children: ReactNode; admin?: boolean }) {
  const { me, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Spinner className="min-h-[50vh]" />;
  if (!me.user)
    return <Navigate to={`/signin?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (admin && me.user.role !== 'admin') return <Navigate to="/app" replace />;
  return <>{children}</>;
}

export function AppLayout() {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-ink-50">
        <AppHeader />
        <main id="main" className="container-page py-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </RequireAuth>
  );
}
