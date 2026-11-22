import { Check } from 'lucide-react';
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
  // Start with the first chosen type the plan covers; others can be added later.
  const allowed = me.plan?.entitlements.profile_types ?? ['career'];
  const startType = pick.find((t) => allowed.includes(t)) ?? (pick.length ? null : 'career');
  const finish = async (to: string) => {
    setBusy(true);
    await api
      .patch('/auth/me', {
        onboarded: true,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      })
      .catch(() => undefined);
    await refresh();
    nav(to);
  };
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[30px] font-semibold">Welcome, {me.user?.name.split(' ')[0]}</h1>
      <p className="mt-2 text-lg text-ink-600">
        What would you like Opportunity Radar to find for you? Choose one or more. You can add or skip any
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
                on ? 'ring-2 ring-ink' : 'hover:shadow-paper',
              )}
            >
              {on && (
                <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white">
                  <Check className="h-4 w-4" />
                </span>
              )}
              <Icon className="h-8 w-8 text-ink-700" />
              <h2 className="mt-3 font-semibold">
                {t === 'career'
                  ? 'A job or consultancy'
                  : t === 'academic'
                    ? 'A scholarship or study place'
                    : 'Tenders for my business'}
              </h2>
              <p className="mt-1 text-sm text-ink-500">{PROFILE_META[t].blurb}</p>
              {!(me.plan?.entitlements.profile_types ?? ['career']).includes(t) && (
                <p className="mt-2 text-[12.5px] font-medium text-ink-500">Needs a paid plan</p>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-8 card p-5">
        <h2 className="font-semibold">Next: tell us about yourself</h2>
        <p className="mt-1 text-sm text-ink-600">
          Fill in your details step by step. As you type we suggest job titles, skills, fields of study and
          services that fit what you have entered, so most answers are one click.
        </p>
        <div className="mt-4">
          <Button
            disabled={busy}
            loading={busy}
            onClick={() => finish(startType ? `/app/profiles/${startType}` : '/pricing')}
          >
            {startType ? `Start my ${startType} profile` : 'See plans'}
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
