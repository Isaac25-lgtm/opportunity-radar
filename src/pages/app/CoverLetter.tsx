import { ArrowLeft, FileDown, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  ErrorAlert,
  Spinner,
  TextArea,
  TextInput,
  useConfirm,
  useToast,
} from '../../components/ui';
import { textToDocx } from '../../cv/exporters';
import { api } from '../../lib/api';
import { downloadBlob } from '../../lib/format';

export default function CoverLetter() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [l, setL] = useState<{ id: string; title: string; body: string } | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api
      .get('/cover-letters')
      .then((r) => {
        const found = r.letters.find((x: any) => x.id === id);
        if (!found) throw new Error('Cover letter not found.');
        setL(found);
      })
      .catch(setErr);
  }, [id]);
  if (err && !l) return <ErrorAlert error={err} />;
  if (!l) return <Spinner />;
  const placeholders = (l.body.match(/\[[^\]]+\]/g) ?? []).length;
  return (
    <div className="mx-auto max-w-3xl">
      {dialog}
      <Link
        to="/app/cvs"
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> CVs & cover letters
      </Link>
      <div className="card space-y-4 p-5 sm:p-7">
        <TextInput label="Title" value={l.title} onChange={(e) => setL({ ...l, title: e.target.value })} />
        {placeholders > 0 && (
          <Alert tone="warn">
            Replace the {placeholders} [bracketed prompt{placeholders === 1 ? '' : 's'}] with your own facts
            before sending. The draft only uses information from your CV.
          </Alert>
        )}
        <TextArea
          label="Letter"
          rows={22}
          value={l.body}
          onChange={(e) => setL({ ...l, body: e.target.value })}
        />
        <ErrorAlert error={err} />
        <div className="flex flex-wrap justify-between gap-2">
          <Button
            variant="ghost"
            className="text-bad-700"
            onClick={async () => {
              if (
                !(await confirm('Delete this cover letter?', 'This cannot be undone.', {
                  confirm: 'Delete',
                  danger: true,
                }))
              )
                return;
              await api.del(`/cover-letters/${l.id}`);
              nav('/app/cvs');
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={async () =>
                downloadBlob(
                  await textToDocx(l.title, l.body),
                  `${l.title.replace(/[^\w\- ]+/g, '').trim() || 'Cover letter'}.docx`,
                )
              }
            >
              <FileDown className="h-4 w-4" /> Word
            </Button>
            <Button
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api.put(`/cover-letters/${l.id}`, { title: l.title, body: l.body });
                  toast('Saved');
                } catch (e) {
                  setErr(e);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
