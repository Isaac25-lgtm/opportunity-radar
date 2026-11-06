import { Check, FileUp } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PROFILE_TYPES, type ProfileType } from '../../../shared/constants';
import { Button, cx } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { PROFILE_META } from './profileConfigs';
import { PROFILE_ICONS } from './Profiles';

export default function Onboarding() {
  const { me, refresh } = useAuth();
  const nav = useNavigate();
  const [pick, setPick] = useState<ProfileType[]>(['career']);
  const [busy, setBusy] = useState(false);
  const finish = async (to: string) => {
    setBusy(true);
    await api
      .patch('/auth/me', {
        onboarded: true,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Kampala',
      })
      .catch(() => undefined);
    await refresh();
    nav(to);
  };
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[30px] font-extrabold">Welcome, {me.user?.name.split(' ')[0]} 👋</h1>
      <p className="mt-2 text-lg text-ink-600">
        What would you like Opportunity Radar to find for you? Choose one or more — you can add or skip any
        type later.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {PROFILE_TYPES.map((t) => {
          const Icon = PROFILE_ICONS[t];
          const on = pick.includes(t);
          return (
            <button
              key={t}
              onClick={() => setPick(on ? pick.filter((x) => x !== t) : [...pick, t])}
              aria-pressed={on}
              className={cx(
                'card relative p-5 text-left transition-all',
                on ? 'ring-2 ring-brand-500' : 'hover:shadow-paper',
              )}
            >
              {on && (
                <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-white">
                  <Check className="h-4 w-4" />
                </span>
              )}
              <Icon className="h-8 w-8 text-brand-500" />
              <h2 className="mt-3 font-bold">
                {t === 'career'
                  ? 'A job or consultancy'
                  : t === 'academic'
                    ? 'A scholarship or study place'
                    : 'Tenders for my business'}
              </h2>
              <p className="mt-1 text-sm text-ink-500">{PROFILE_META[t].blurb}</p>
            </button>
          );
        })}
      </div>
      <div className="mt-8 card p-5">
        <h2 className="font-bold">Fastest start</h2>
        <p className="mt-1 text-sm text-ink-600">
          Upload your CV and we will extract your experience, education and skills for you to review. Nothing
          is saved until you confirm.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => finish('/app/cvs/import')} loading={busy}>
            <FileUp className="h-4 w-4" /> Upload my CV
          </Button>
          <Button
            variant="secondary"
            disabled={!pick.length || busy}
            onClick={() => finish(`/app/profiles/${pick[0]}`)}
          >
            Fill in my {pick[0] ?? 'career'} profile manually
          </Button>
        </div>
      </div>
      <p className="mt-6 text-center text-sm text-ink-500">
        <button type="button" onClick={() => void finish('/app')} disabled={busy} className="link">
          Skip for now
        </button>
      </p>
    </div>
  );
}
