import { CheckCircle2 } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button, ErrorAlert, TextInput } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { safeNext } from '../../lib/redirect';


function Shell({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <section className="bg-ink-100 py-10 sm:py-16">
      <div className="container-page grid max-w-5xl overflow-hidden rounded-2xl bg-white shadow-card md:grid-cols-2">
        <div className="p-6 sm:p-10">
          <h1 className="text-[28px] font-extrabold">{title}</h1>
          {subtitle && <p className="mt-2 text-[15px] text-ink-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        <div className="hidden flex-col justify-center bg-brand-500 p-10 text-white md:flex">
          <h2 className="text-2xl font-extrabold">One profile, every opportunity that fits</h2>
          <ul className="mt-6 space-y-3 text-[15px]">
            {[
              'ATS-friendly CV builder with live preview',
              'Jobs, scholarships, grants and tenders from verified sources',
              'Clear eligibility checks and honest match explanations',
              'Deadline reminders and an application tracker',
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function SignIn() {
  const { me, refresh } = useAuth();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  if (me.user) return <Navigate to={safeNext(sp.get('next'), '/app')} replace />;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api.post('/auth/signin', f);
      await refresh();
      nav(safeNext(sp.get('next'), '/app'), { replace: true });
    } catch (x) {
      setErr(x);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell
      title="Welcome back"
      subtitle={
        <>
          New here?{' '}
          <Link
            to={`/signup${sp.get('next') ? `?next=${encodeURIComponent(sp.get('next')!)}` : ''}`}
            className="link"
          >
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <ErrorAlert error={err} />
        <TextInput
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={f.email}
          onChange={(e) => setF({ ...f, email: e.target.value })}
        />
        <TextInput
          label="Password"
          type="password"
          required
          autoComplete="current-password"
          value={f.password}
          onChange={(e) => setF({ ...f, password: e.target.value })}
        />
        <div className="text-right">
          <Link to="/forgot-password" className="text-sm font-semibold text-brand-600 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" loading={busy} className="w-full" size="lg">
          Sign in
        </Button>
      </form>
    </Shell>
  );
}

export function SignUp() {
  const { me, refresh } = useAuth();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', password: '', accept_terms: false });
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  if (me.user) return <Navigate to="/app" replace />;
  const details = err instanceof ApiError ? (err.details ?? {}) : {};
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api.post('/auth/signup', f);
      await refresh();
      nav(safeNext(sp.get('next'), '/app/onboarding'), { replace: true });
    } catch (x) {
      setErr(x);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell
      title="Create your free account"
      subtitle={
        <>
          Already registered?{' '}
          <Link to="/signin" className="link">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <ErrorAlert error={err} />
        <TextInput
          label="Full name"
          required
          autoComplete="name"
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
          error={details.name}
        />
        <TextInput
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={f.email}
          onChange={(e) => setF({ ...f, email: e.target.value })}
          error={details.email}
        />
        <TextInput
          label="Password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          value={f.password}
          onChange={(e) => setF({ ...f, password: e.target.value })}
          error={details.password}
          hint="At least 10 characters, with a letter and a number."
        />
        <label className="flex items-start gap-3 text-sm text-ink-600">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-500"
            checked={f.accept_terms}
            onChange={(e) => setF({ ...f, accept_terms: e.target.checked })}
            required
          />
          <span>
            I agree to the{' '}
            <Link to="/terms" className="link" target="_blank">
              terms of use
            </Link>{' '}
            and have read the{' '}
            <Link to="/privacy" className="link" target="_blank">
              privacy policy
            </Link>
            .
          </span>
        </label>
        {details.accept_terms && <p className="text-xs font-medium text-bad-700">{details.accept_terms}</p>}
        <Button type="submit" loading={busy} className="w-full" size="lg">
          Create account
        </Button>
      </form>
    </Shell>
  );
}

export function Forgot() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState<{ message: string; dev_reset_link: string | null } | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Shell
      title="Reset your password"
      subtitle="Enter the email you registered with and we will send you a reset link."
    >
      {done ? (
        <div className="space-y-4">
          <Alert tone="ok">{done.message}</Alert>
          {done.dev_reset_link && (
            <Alert tone="warn" title="Development mode">
              Email is not configured, so here is the link:{' '}
              <a href={done.dev_reset_link} className="break-all font-semibold underline">
                reset password
              </a>
            </Alert>
          )}
          <Link to="/signin" className="link">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setErr(null);
            try {
              setDone(await api.post('/auth/forgot', { email }));
            } catch (x) {
              setErr(x);
            } finally {
              setBusy(false);
            }
          }}
        >
          <ErrorAlert error={err} />
          <TextInput
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" loading={busy} className="w-full" size="lg">
            Send reset link
          </Button>
        </form>
      )}
    </Shell>
  );
}

export function Reset() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const token = sp.get('token') ?? '';
  return (
    <Shell title="Choose a new password">
      {!token ? (
        <Alert tone="bad">This reset link is incomplete. Request a new one.</Alert>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setErr(null);
            try {
              await api.post('/auth/reset', { token, password: pw });
              nav('/signin', { replace: true });
            } catch (x) {
              setErr(x);
            } finally {
              setBusy(false);
            }
          }}
        >
          <ErrorAlert error={err} />
          <TextInput
            label="New password"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            hint="At least 10 characters, with a letter and a number."
          />
          <Button type="submit" loading={busy} className="w-full" size="lg">
            Update password
          </Button>
        </form>
      )}
    </Shell>
  );
}
