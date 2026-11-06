import { Printer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { CvTemplate } from '../../../shared/constants';
import type { CvData } from '../../../shared/cv';
import { Button, ErrorAlert, Spinner } from '../../components/ui';
import { CvDocument } from '../../cv/templates';
import { api } from '../../lib/api';

/** Print-ready A4 page. The browser's "Save as PDF" produces a text-based, ATS-readable PDF. */
export default function CvPrint() {
  const { id } = useParams();
  return <PrintView key={id} id={id!} />;
}

type PrintableCv = { title: string; template: CvTemplate; data: CvData };

function PrintView({ id }: { id: string }) {
  const [cv, setCv] = useState<PrintableCv | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const load = useRef<Promise<{ cv: PrintableCv }>>();
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    load.current ??= api.post<{ cv: PrintableCv }>(`/cvs/${id}/export`, { format: 'pdf' });
    void load.current
      .then((r) => {
        if (!active) return;
        setCv(r.cv);
        document.title = `${r.cv.data.personal.fullName || r.cv.title} — CV`;
        timer = setTimeout(() => window.print(), 700);
      })
      .catch((error) => {
        if (active) setErr(error);
      });
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id]);
  if (err)
    return (
      <div className="p-6">
        <ErrorAlert error={err} />
      </div>
    );
  if (!cv) return <Spinner className="min-h-screen" />;
  return (
    <div className="min-h-screen bg-ink-100 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[794px] items-center justify-between px-2">
        <p className="text-sm text-ink-600">
          In the print dialog choose <strong>Save as PDF</strong>, paper size A4, and turn off headers and
          footers.
        </p>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print / Save PDF
        </Button>
      </div>
      <div className="mx-auto w-[794px] shadow-paper print:shadow-none">
        <CvDocument data={cv.data} template={cv.template} />
      </div>
    </div>
  );
}
