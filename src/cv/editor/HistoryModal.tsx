import { useCallback, useEffect, useState } from 'react';
import { CV_TEMPLATE_LABELS, type CvTemplate } from '../../../shared/constants';
import { Button, Modal, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { fmtDateTime } from '../../lib/format';

/** Version history: list snapshots, save the current state and restore an earlier version. */
export function HistoryModal({
  cvId,
  onClose,
  onSnapshot,
  onRestored,
}: {
  cvId: string;
  onClose: () => void;
  onSnapshot: () => Promise<void>;
  onRestored: () => void;
}) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const load = useCallback(() => api.get(`/cvs/${cvId}/versions`).then((r) => setRows(r.versions)), [cvId]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <Modal
      open
      onClose={onClose}
      title="Version history"
      footer={
        <Button
          variant="secondary"
          onClick={async () => {
            await onSnapshot();
            await load();
          }}
        >
          Save current version
        </Button>
      }
    >
      {!rows ? (
        <Spinner />
      ) : (
        <ul className="divide-y divide-ink-100">
          {rows.map((v) => (
            <li key={v.version} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-semibold">Version {v.version}</p>
                <p className="text-xs text-ink-500">
                  {fmtDateTime(v.created_at)} · {v.note} ·{' '}
                  {CV_TEMPLATE_LABELS[v.template as CvTemplate]?.name}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                loading={busy === v.version}
                onClick={async () => {
                  setBusy(v.version);
                  await api.post(`/cvs/${cvId}/versions/${v.version}/restore`);
                  onRestored();
                }}
              >
                Restore
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-ink-500">
        Restoring keeps a copy of your current CV as a new version first.
      </p>
    </Modal>
  );
}
