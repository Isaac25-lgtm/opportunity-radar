import { CheckCircle2 } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button, ErrorAlert, TextInput, useLoad } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { safeNext } from '../../lib/redirect';

function Shell({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <section className="bg-ink-50 py-10 sm:py-16">
      <div className="container-page max-w-5xl">
        <div className="grid overflow-hidden rounded-2xl border border-line bg-white shadow-card md:grid-cols-2">
          <div className="p-6 sm:p-10">
            <h1 className="text-[28px] font-semibold">{title}</h1>
            {subtitle && <p className="mt-2 text-[15px] text-ink-500">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>
          {/* A real photo with a soft fade only where the text sits, instead of a flat black panel. */}
          <div className="relative isolate hidden min-h-[560px] flex-col justify-end overflow-hidden p-10 text-white md:flex">
            <img
              src="/photos/card-career-bg.webp"
              alt=""
              className="absolute inset-0 -z-10 h-full w-full object-cover"
            />
            <div
              className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/35 to-transparent"
              aria-hidden
            />
            <h2 className="text-[24px] font-medium leading-snug text-white">
              One profile, every opportunity that fits
            </h2>
            <ul className="mt-5 space-y-3 text-[15px] text-white/90">
              {[
                'Build a professional CV, step by step',
                'Find jobs, scholarships and contracts, worldwide',
                'See clearly whether you qualify, and why',
                'Get reminders before deadlines',
              ].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] flex-none text-white/80" aria-hidden />{' '}
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

const GOOGLE_ERRORS: Record<string, string> = {
  google_unavailable: 'Google sign-in is not available yet. Please use your email address for now.',
  google_cancelled: 'Google sign-in was cancelled. You can try again or use your email address.',
  google_unverified:
    'Your Google account email is not verified. Verify it with Google, or sign up with email.',
  google_failed: 'We could not sign you in with Google. Please try again or use your email address.',
};

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="h-[18px] w-[18px]" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.97 8.97 0 0 0 9 0 9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

/**
 * "Continue with Google". Shown on sign-in and sign-up; while Google sign-in is not switched on (no keys yet),
 * it is visible but disabled and marked "coming soon".
 */
function GoogleSignIn({ next, terms }: { next: string; terms?: boolean }) {
  const providers = useLoad(() => api.get<{ google: boolean }>('/auth/providers'), []);
  const enabled = providers.data?.google === true;
  const label = (
    <>
      <GoogleMark /> Continue with Google
    </>
  );
  return (
    <div>
      {enabled ? (
        <a
          href={`/api/auth/google/start?next=${encodeURIComponent(next)}`}
          className="btn btn-lg btn-outline w-full gap-2.5"
        >
          {label}
        </a>
      ) : (
        <button type="button" disabled className="btn btn-lg btn-outline w-full gap-2.5 opacity-70">
          {label}
          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11.5px] font-medium text-ink-500">
            Coming soon
          </span>
        </button>
      )}
      {terms && enabled && (
        <p className="mt-2 text-center text-[12.5px] text-ink-500">
          By continuing with Google you agree to the{' '}
          <Link to="/terms" className="link" target="_blank">
            terms of use
          </Link>{' '}
          and have read the{' '}
          <Link to="/privacy" className="link" target="_blank">
            privacy policy
          </Link>
          .
        </p>
      )}
      <div className="my-5 flex items-center gap-3 text-[13px] text-ink-400" aria-hidden>
        <span className="h-px flex-1 bg-line" /> or use your email <span className="h-px flex-1 bg-line" />
      </div>
    </div>
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
      {GOOGLE_ERRORS[sp.get('error') ?? ''] && (
        <Alert tone="warn" className="mb-4">
          {GOOGLE_ERRORS[sp.get('error')!]}
        </Alert>
      )}
      <GoogleSignIn next={safeNext(sp.get('next'), '/app')} />
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
          <Link to="/forgot-password" className="link text-sm">
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
      <GoogleSignIn next={safeNext(sp.get('next'), '/app/onboarding')} terms />
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
            className="mt-0.5 h-4 w-4 rounded border-ink-300 text-ink-700"
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
