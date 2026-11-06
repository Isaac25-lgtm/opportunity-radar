import { ArrowLeft, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PROFILE_TYPES, type ProfileType } from '../../../shared/constants';
import { profileCompleteness } from '../../../shared/completeness';
import { FormSections } from '../../components/FormBuilder';
import { Button, ErrorAlert, Progress, Spinner, useConfirm, useToast } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { PROFILE_META, PROFILE_SECTIONS } from './profileConfigs';

export default function ProfileEditor() {
  const { type } = useParams() as { type: ProfileType };
  const nav = useNavigate();
  const toast = useToast();
  const { refresh } = useAuth();
  const { confirm, dialog } = useConfirm();
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [exists, setExists] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const valid = (PROFILE_TYPES as readonly string[]).includes(type);

  useEffect(() => {
    if (!valid) return;
    setData(null);
    api
      .get(`/profiles/${type}`)
      .then((r) => {
        setExists(!!r.profile);
        setData(r.profile?.data ?? {});
      })
      .catch(setErr);
  }, [type, valid]);

  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, [dirty]);

  const completeness = useMemo(
    () => (data ? profileCompleteness(type, data) : { score: 0, missing: [] }),
    [data, type],
  );
  if (!valid) return <ErrorAlert error="Unknown profile type." />;
  if (!data) return err ? <ErrorAlert error={err} /> : <Spinner />;
  const details = err instanceof ApiError ? (err.details ?? {}) : {};

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.put(`/profiles/${type}`, { data });
      setExists(true);
      setDirty(false);
      await refresh();
      toast('Profile saved');
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl pb-24">
      {dialog}
      <Link
        to="/app/profiles"
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> All profiles
      </Link>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-bold">{PROFILE_META[type].title}</h1>
          <p className="text-ink-500">{PROFILE_META[type].blurb}</p>
        </div>
        <div className="w-full sm:w-64">
          <div className="mb-1 flex justify-between text-sm">
            <span className="font-semibold">Profile completeness</span>
            <span className="font-bold">{completeness.score}%</span>
          </div>
          <Progress value={completeness.score} />
          {completeness.missing.length > 0 && (
            <p className="mt-1 text-xs text-ink-500">Next: {completeness.missing.slice(0, 3).join(', ')}</p>
          )}
        </div>
      </div>
      {type === 'career' && (
        <p className="mb-4 text-sm text-ink-500">
          Have a CV already?{' '}
          <Link to="/app/cvs/import" className="link">
            Import it
          </Link>{' '}
          to fill this profile for you to review.
        </p>
      )}
      <ErrorAlert error={err} className="mb-4" />
      <FormSections
        sections={PROFILE_SECTIONS[type]}
        data={data}
        errors={details}
        onChange={(k, v) => {
          setData((d) => ({ ...d, [k]: v }));
          setDirty(true);
        }}
      />
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white/95 backdrop-blur">
        <div className="container-page flex max-w-4xl items-center justify-between gap-3 py-3">
          {exists ? (
            <Button
              variant="ghost"
              className="text-bad-700"
              onClick={async () => {
                if (
                  !(await confirm(
                    'Delete this profile?',
                    'Its data will be removed. CVs and tracked applications are kept.',
                    { confirm: 'Delete profile', danger: true },
                  ))
                )
                  return;
                await api.del(`/profiles/${type}`);
                await refresh();
                toast('Profile deleted', 'info');
                nav('/app/profiles');
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          ) : (
            <span className="text-sm text-ink-500">{dirty ? 'Unsaved changes' : 'Not saved yet'}</span>
          )}
          <div className="flex gap-2">
            {exists && (
              <Link
                to={`/app/opportunities?view=${type}`}
                className="btn btn-md btn-outline hidden sm:inline-flex"
              >
                See matches
              </Link>
            )}
            <Button onClick={save} loading={busy}>
              {exists ? 'Save changes' : 'Create profile'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
