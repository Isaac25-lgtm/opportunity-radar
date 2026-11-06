import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  ChipSelect,
  ErrorAlert,
  Modal,
  SelectInput,
  Spinner,
  TextInput,
  Toggle,
  useToast,
} from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';

const TZS = [
  'Africa/Kampala',
  'Africa/Nairobi',
  'Africa/Dar_es_Salaam',
  'Africa/Kigali',
  'Africa/Juba',
  'Africa/Johannesburg',
  'Europe/London',
  'America/New_York',
  'UTC',
];
const HOURS = Array.from({ length: 24 }, (_, h) => ({
  value: String(h),
  label: `${String(h).padStart(2, '0')}:00`,
}));

export default function Settings() {
  const { me, refresh } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [name, setName] = useState(me.user?.name ?? '');
  const [tz, setTz] = useState(me.user?.timezone ?? 'Africa/Kampala');
  const [prefs, setPrefs] = useState<any>(null);
  const [allowed, setAllowed] = useState<string[]>([]);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [del, setDel] = useState(false);
  const [delPw, setDelPw] = useState('');
  useEffect(() => {
    api.get('/notifications/prefs').then((r) => {
      setPrefs(r.prefs);
      setAllowed(r.allowed_frequencies);
    });
  }, []);
  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    setErr(null);
    try {
      await fn();
      toast(ok);
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(null);
    }
  };
  const details = err instanceof ApiError ? (err.details ?? {}) : {};
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-[28px] font-bold">Settings</h1>
      <ErrorAlert error={err} />
      <section className="card space-y-4 p-6">
        <h2 className="text-lg font-bold">Account</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <TextInput
            label="Email"
            value={me.user?.email ?? ''}
            disabled
            hint="Contact us to change your email."
          />
          <SelectInput
            label="Timezone"
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            options={TZS.map((t) => ({ value: t, label: t.replace('_', ' ') }))}
            hint="Used for deadlines and quiet hours."
          />
        </div>
        <Button
          loading={busy === 'acct'}
          onClick={() =>
            run(
              'acct',
              async () => {
                await api.patch('/auth/me', { name, timezone: tz });
                await refresh();
              },
              'Account updated',
            )
          }
        >
          Save account
        </Button>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-bold">Alerts</h2>
        {!prefs ? (
          <Spinner />
        ) : (
          <div className="mt-2 space-y-4">
            <Toggle
              label="Email alerts"
              description="Sent to your account email."
              checked={prefs.email_enabled}
              onChange={(v) => setPrefs({ ...prefs, email_enabled: v })}
            />
            <Toggle
              label="In-app notifications"
              checked={prefs.in_app_enabled}
              onChange={(v) => setPrefs({ ...prefs, in_app_enabled: v })}
            />
            <SelectInput
              label="Match alert frequency"
              value={prefs.frequency}
              onChange={(e) => setPrefs({ ...prefs, frequency: e.target.value })}
              options={[
                {
                  value: 'instant',
                  label: `Instant${allowed.includes('instant') ? '' : ' (Pro and Elite)'}`,
                },
                {
                  value: 'daily',
                  label: `Daily digest${allowed.includes('daily') ? '' : ' (Basic and above)'}`,
                },
                { value: 'weekly', label: 'Weekly digest' },
                { value: 'off', label: 'Off' },
              ]}
              error={details.frequency}
            />
            <ChipSelect
              label="Alert me about"
              value={prefs.categories}
              onChange={(v) => setPrefs({ ...prefs, categories: v })}
              options={[
                { value: 'new_match', label: 'New matches' },
                { value: 'deadline', label: 'Deadlines' },
                { value: 'follow_up', label: 'Follow-ups' },
                { value: 'status_change', label: 'Status changes' },
              ]}
            />
            <TextInput
              label="Minimum relevance for match alerts"
              type="number"
              min={0}
              max={100}
              value={prefs.min_score}
              onChange={(e) =>
                setPrefs({ ...prefs, min_score: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })
              }
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectInput
                label="Quiet hours start"
                value={prefs.quiet_start === null ? '' : String(prefs.quiet_start)}
                placeholder="None"
                onChange={(e) =>
                  setPrefs({ ...prefs, quiet_start: e.target.value === '' ? null : Number(e.target.value) })
                }
                options={HOURS}
              />
              <SelectInput
                label="Quiet hours end"
                value={prefs.quiet_end === null ? '' : String(prefs.quiet_end)}
                placeholder="None"
                onChange={(e) =>
                  setPrefs({ ...prefs, quiet_end: e.target.value === '' ? null : Number(e.target.value) })
                }
                options={HOURS}
              />
            </div>
            <Button
              loading={busy === 'prefs'}
              onClick={() =>
                run(
                  'prefs',
                  () =>
                    api.put('/notifications/prefs', {
                      email_enabled: prefs.email_enabled,
                      in_app_enabled: prefs.in_app_enabled,
                      frequency: prefs.frequency,
                      categories: prefs.categories,
                      min_score: prefs.min_score,
                      quiet_start: prefs.quiet_start,
                      quiet_end: prefs.quiet_end,
                    }),
                  'Alert settings saved',
                )
              }
            >
              Save alert settings
            </Button>
          </div>
        )}
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-lg font-bold">Password</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={pw.current}
            onChange={(e) => setPw({ ...pw, current: e.target.value })}
            error={details.current}
          />
          <TextInput
            label="New password"
            type="password"
            autoComplete="new-password"
            value={pw.next}
            onChange={(e) => setPw({ ...pw, next: e.target.value })}
            error={details.next}
            hint="At least 10 characters with a letter and a number."
          />
        </div>
        <Button
          loading={busy === 'pw'}
          onClick={() =>
            run(
              'pw',
              async () => {
                await api.post('/auth/change-password', pw);
                setPw({ current: '', next: '' });
              },
              'Password changed; other sessions signed out',
            )
          }
        >
          Change password
        </Button>
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="text-lg font-bold">Your data</h2>
        <p className="text-sm text-ink-600">
          Download everything we hold about you as a JSON file, or permanently delete your account.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/auth/export" className="btn btn-md btn-secondary">
            <Download className="h-4 w-4" /> Export my data
          </a>
          <Button variant="danger" onClick={() => setDel(true)}>
            Delete my account
          </Button>
        </div>
      </section>

      <Modal
        open={del}
        onClose={() => setDel(false)}
        title="Delete your account permanently?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDel(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy === 'del'}
              disabled={!delPw}
              onClick={() =>
                run(
                  'del',
                  async () => {
                    await api.post('/auth/delete-account', { password: delPw });
                    await refresh();
                    nav('/');
                  },
                  'Account deleted',
                )
              }
            >
              Delete everything
            </Button>
          </>
        }
      >
        <Alert tone="bad">
          This removes your profiles, CVs, documents, applications and notifications. It cannot be undone.
        </Alert>
        <TextInput
          className="mt-4"
          label="Confirm with your password"
          type="password"
          value={delPw}
          onChange={(e) => setDelPw(e.target.value)}
        />
      </Modal>
    </div>
  );
}
