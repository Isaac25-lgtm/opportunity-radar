import { Link } from 'react-router-dom';
import { HELP_SECTIONS } from '../../../shared/help';

export default function Help() {
  return (
    <section className="py-14">
      <div className="container-page max-w-3xl">
        <h1 className="text-[36px] font-semibold sm:text-[44px]">Help centre</h1>
        <p className="mt-3 text-lg text-ink-600">
          Can’t find an answer?{' '}
          <Link to="/contact" className="link">
            Contact us
          </Link>
          .
        </p>
        {HELP_SECTIONS.map(([title, items]) => (
          <div key={title} className="mt-10">
            <h2 className="text-xl font-semibold">{title}</h2>
            <div className="mt-3 divide-y divide-ink-200 rounded-lg border border-ink-200 bg-white">
              {items.map(([q, a]) => (
                <details key={q} className="group px-5 py-4">
                  <summary className="cursor-pointer list-none font-semibold marker:hidden group-open:text-brand-600">
                    {q}
                  </summary>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-600">{a}</p>
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
