import { CheckCircle2, Download, Eye, FileUp, ShieldCheck, Wand2 } from 'lucide-react';
import { CV_TEMPLATE_LABELS } from '../../../shared/constants';
import { CvThumb } from '../../components/CvThumb';
import { ButtonLink } from '../../components/ui';
import { SAMPLE_CV } from '../../cv/sample';
import { useAuth } from '../../lib/auth';

export default function CvBuilderLanding() {
  const { me } = useAuth();
  const start = me.user ? '/app/cvs' : '/signup?next=/app/cvs';
  return (
    <>
      <section className="bg-ink-100">
        <div className="container-page grid items-center gap-12 py-16 lg:grid-cols-2">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-brand-600">CV Builder</p>
            <h1 className="mt-3 text-[38px] font-extrabold leading-tight sm:text-[50px]">
              Build a professional CV in minutes
            </h1>
            <p className="mt-4 text-lg text-ink-600">
              Start from scratch or upload your current CV. Edit section by section with a live A4 preview,
              then download a clean PDF or Word file.
            </p>
            <ul className="mt-6 space-y-2 text-[15px] text-ink-700">
              {[
                'Live preview as you type',
                'Three templates: modern, ATS-friendly and academic',
                'Multiple versions for different roles, with history and restore',
                'Warnings for missing dates, contacts and descriptions',
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-ok-500" /> {t}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink to={start} size="lg">
                Create my CV
              </ButtonLink>
              <ButtonLink
                to={me.user ? '/app/cvs/import' : '/signup?next=/app/cvs/import'}
                size="lg"
                variant="secondary"
              >
                <FileUp className="h-5 w-5" /> Upload existing CV
              </ButtonLink>
            </div>
          </div>
          <div className="mx-auto w-full max-w-[460px] overflow-hidden rounded-lg shadow-paper">
            <CvThumb data={SAMPLE_CV} template="modern" />
          </div>
        </div>
      </section>
      <section className="py-20">
        <div className="container-page grid gap-10 md:grid-cols-4">
          {[
            [
              FileUp,
              'Import or start fresh',
              'PDF and Word CVs are read in your browser and turned into editable sections for you to check.',
            ],
            [
              Eye,
              'See every change',
              'The A4 preview updates instantly. Reorder or hide sections to fit the role.',
            ],
            [
              Wand2,
              'Tailor honestly',
              'Compare your CV with an opportunity: we highlight matching skills and gaps — you decide what is true to add.',
            ],
            [
              Download,
              'Download anywhere',
              'Export to PDF from any plan; Word (.docx) export is included from the Basic plan.',
            ],
          ].map(([I, t, d]) => {
            const Icon = I as typeof Eye;
            return (
              <div key={t as string}>
                <Icon className="h-8 w-8 text-brand-500" />
                <h3 className="mt-4 text-lg font-bold">{t as string}</h3>
                <p className="mt-2 text-[15px] text-ink-600">{d as string}</p>
              </div>
            );
          })}
        </div>
      </section>
      <section className="bg-ink-50 py-16">
        <div className="container-page flex flex-col items-center gap-4 text-center">
          <ShieldCheck className="h-10 w-10 text-ok-500" />
          <h2 className="text-2xl font-extrabold sm:text-3xl">Factual integrity is built in</h2>
          <p className="max-w-2xl text-ink-600">
            The builder never invents employers, job titles, dates, degrees, grades, skills, achievements or
            certifications. Templates like {CV_TEMPLATE_LABELS.ats.name} are designed to be read correctly by
            applicant-tracking systems.
          </p>
        </div>
      </section>
    </>
  );
}
