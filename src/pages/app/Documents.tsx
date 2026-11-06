import { Download, FileText, FolderOpen, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { DOCUMENT_KINDS, MAX_UPLOAD_BYTES } from '../../../shared/constants';
import {
  Button,
  EmptyState,
  ErrorAlert,
  PageHeader,
  SelectInput,
  Spinner,
  useConfirm,
  useLoad,
  useToast,
} from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { fmtDate } from '../../lib/format';
import { formatLimit } from '../../../shared/entitlements';

const KIND_LABEL: Record<string, string> = {
  cv: 'CV',
  company_profile: 'Company profile',
  transcript: 'Academic transcript',
  certificate: 'Certificate',
  cover_letter: 'Cover letter',
  other: 'Other',
};

export default function Documents() {
  const { me } = useAuth();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const { data, error, loading, reload } = useLoad(() => api.get<{ documents: any[] }>('/documents'), []);
  const [kind, setKind] = useState('cv');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const input = useRef<HTMLInputElement>(null);
  const upload = async (f: File) => {
    setErr(null);
    if (f.size > MAX_UPLOAD_BYTES) return setErr(new Error('Files must be 5 MB or smaller.'));
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      fd.append('kind', kind);
      await api.upload('/documents', fd);
      toast('Uploaded');
      reload();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  return (
    <>
      {dialog}
      <PageHeader
        title="Documents"
        subtitle={`Private storage for CVs, company profiles, transcripts and certificates. Only you can download them. Plan limit: ${formatLimit(me.plan?.entitlements.max_documents ?? 3)}.`}
      />
      <div className="card mb-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
        <SelectInput
          className="sm:w-64"
          label="Document type"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          options={DOCUMENT_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
        />
        <Button loading={busy} onClick={() => input.current?.click()}>
          <Upload className="h-4 w-4" /> Upload file
        </Button>
        <input
          ref={input}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.png,.jpg,.jpeg"
          onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])}
        />
        <p className="text-xs text-ink-500 sm:ml-auto">PDF, DOCX, PNG or JPG · up to 5 MB</p>
      </div>
      <ErrorAlert error={err || error} className="mb-4" />
      {loading ? (
        <Spinner />
      ) : data?.documents.length ? (
        <ul className="card divide-y divide-ink-100">
          {data.documents.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-5 py-4">
              <FileText className="h-6 w-6 flex-none text-brand-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{d.filename}</p>
                <p className="text-xs text-ink-500">
                  {KIND_LABEL[d.kind]} · {(d.size / 1024).toFixed(0)} KB · {fmtDate(d.created_at)}
                </p>
              </div>
              <a
                href={`/api/documents/${d.id}/download`}
                className="rounded p-2 text-ink-500 hover:bg-ink-100"
                aria-label={`Download ${d.filename}`}
              >
                <Download className="h-5 w-5" />
              </a>
              <button
                className="rounded p-2 text-ink-500 hover:bg-bad-50 hover:text-bad-500"
                aria-label={`Delete ${d.filename}`}
                onClick={async () => {
                  if (
                    !(await confirm(
                      'Delete document?',
                      `“${d.filename}” will be permanently deleted from storage.`,
                      { confirm: 'Delete', danger: true },
                    ))
                  )
                    return;
                  await api.del(`/documents/${d.id}`);
                  reload();
                  toast('Deleted', 'info');
                }}
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<FolderOpen className="h-10 w-10" />} title="No documents yet">
          Upload documents to attach them to tracked applications and bids.
        </EmptyState>
      )}
    </>
  );
}
