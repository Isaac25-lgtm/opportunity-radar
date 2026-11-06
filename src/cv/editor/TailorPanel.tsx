import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, ErrorAlert, Modal, Spinner } from '../../components/ui';
import { api, ApiError } from '../../lib/api';

/** Compare a CV with an opportunity, then create a tailored copy or draft a cover letter. */
export function TailorPanel({
  cvId,
  initialOpp,
  onClose,
  onCopy,
}: {
  cvId: string;
  initialOpp: string | null;
  onClose: () => void;
  onCopy: (id: string) => void;
}) {
  const nav = useNavigate();
  const [oppId, setOppId] = useState(initialOpp ?? '');
  const [saved, setSaved] = useState<any[] | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    api
      .get('/opportunities/saved')
      .then((r) => setSaved(r.items))
      .catch(() => setSaved([]));
  }, []);
  useEffect(() => {
    if (!oppId) return;
    setAnalysis(null);
    setErr(null);
    api
      .post(`/cvs/${cvId}/tailor`, { opportunity_id: oppId })
      .then((r) => setAnalysis(r.analysis))
      .catch(setErr);
  }, [oppId, cvId]);
  const upgrade = err instanceof ApiError && err.status === 402;
  return (
    <Modal open onClose={onClose} title="Tailor this CV" wide>
      <p className="text-sm text-ink-600">
        Compare your CV with an opportunity. We show what matches and what the notice asks for — you decide
        what is true to add.
      </p>
      <div className="mt-4">
        <label className="field-label" htmlFor="tailor-opp">
          Opportunity
        </label>
        <select id="tailor-opp" className="input" value={oppId} onChange={(e) => setOppId(e.target.value)}>
          <option value="">Choose a saved opportunity…</option>
          {initialOpp && !saved?.some((s) => s.id === initialOpp) && (
            <option value={initialOpp}>Selected opportunity</option>
          )}
          {saved?.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title} — {o.organization}
            </option>
          ))}
        </select>
        {saved && !saved.length && !initialOpp && (
          <p className="mt-2 text-xs text-ink-500">
            Save an opportunity first, or open one and choose “Tailor CV”.
          </p>
        )}
      </div>
      <ErrorAlert error={err} className="mt-4" />
      {oppId && !analysis && !err && <Spinner />}
      {analysis && (
        <div className="mt-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-ok-700">
              Skills you already list that the notice mentions
            </h3>
            <p className="mt-1 text-sm">
              {analysis.matched_skills.length
                ? analysis.matched_skills.join(', ')
                : 'None found — check that your skills use the same words as the notice.'}
            </p>
          </div>
          {analysis.missing_keywords.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-warn-700">Mentioned in the notice, not in your CV</h3>
              <p className="mt-1 text-sm">{analysis.missing_keywords.join(', ')}</p>
              <p className="mt-1 text-xs text-ink-500">
                Add these only if you genuinely have the experience.
              </p>
            </div>
          )}
          {analysis.suggestions.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-700">
              {analysis.suggestions.map((s: string) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
          {upgrade && <Alert tone="warn">Tailored copies are included from the Basic plan.</Alert>}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              loading={busy === 'copy'}
              onClick={async () => {
                setBusy('copy');
                try {
                  const r = await api.post(`/cvs/${cvId}/tailor`, {
                    opportunity_id: oppId,
                    create_copy: true,
                  });
                  onCopy(r.id);
                  onClose();
                } catch (e) {
                  setErr(e);
                } finally {
                  setBusy(null);
                }
              }}
            >
              <Sparkles className="h-4 w-4" /> Create tailored copy
            </Button>
            <Button
              variant="secondary"
              loading={busy === 'letter'}
              onClick={async () => {
                setBusy('letter');
                try {
                  const r = await api.post('/cover-letters/draft', { cv_id: cvId, opportunity_id: oppId });
                  nav(`/app/cover-letters/${r.id}`);
                } catch (e) {
                  setErr(e);
                } finally {
                  setBusy(null);
                }
              }}
            >
              Draft cover letter
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
