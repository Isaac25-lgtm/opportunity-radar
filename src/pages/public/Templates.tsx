import { Link } from 'react-router-dom';
import { CV_TEMPLATE_LABELS, CV_TEMPLATES } from '../../../shared/constants';
import { CvThumb } from '../../components/CvThumb';
import { useAuth } from '../../lib/auth';
import { SAMPLE_CV } from '../../cv/sample';
import { ACCENTS } from '../../cv/templates';

export default function Templates() {
  const { me } = useAuth();
  return (
    <section className="py-14">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-[36px] font-extrabold sm:text-[46px]">CV templates</h1>
          <p className="mt-3 text-lg text-ink-600">
            Each template uses the same content, so you can switch at any time. Pick an accent colour in the
            editor.
          </p>
        </div>
        <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {CV_TEMPLATES.map((t, i) => (
            <Link key={t} to={me.user ? '/app/cvs' : '/signup?next=/app/cvs'} className="group">
              <div className="overflow-hidden rounded-lg shadow-card ring-1 ring-ink-100 transition-all group-hover:-translate-y-1 group-hover:shadow-paper">
                <CvThumb data={{ ...SAMPLE_CV, accent: ACCENTS[i] }} template={t} />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold group-hover:text-brand-600">
                    {CV_TEMPLATE_LABELS[t].name}
                  </h2>
                  <p className="text-sm text-ink-500">{CV_TEMPLATE_LABELS[t].blurb}</p>
                </div>
                <span className="btn btn-sm btn-secondary opacity-0 transition-opacity group-hover:opacity-100">
                  Use template
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
