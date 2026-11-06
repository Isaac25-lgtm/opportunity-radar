import { Link } from 'react-router-dom';

const SECTIONS: Array<[string, Array<[string, string]>]> = [
  [
    'Getting started',
    [
      [
        'How do I create a profile?',
        'Sign up, then choose Career, Academic or Business in the onboarding screen. You can skip any type and add it later from Profiles.',
      ],
      [
        'Can I have more than one profile?',
        'Yes — one of each type per account. The number of active profiles depends on your plan (Free: 1, Basic: 2, Pro and Elite: 3).',
      ],
      [
        'Why do you ask for my nationality?',
        'Only to check published eligibility rules — many scholarships and some jobs are restricted by nationality or residency. Leave it blank and we will mark those opportunities as needing confirmation.',
      ],
    ],
  ],
  [
    'CV Builder',
    [
      [
        'How does CV import work?',
        'Your PDF or Word file is read in your browser and split into sections. You review every field before anything is saved. If a section was not recognised, you can add it manually.',
      ],
      [
        'How do I download my CV?',
        'Open the CV, then use “Download PDF”. This opens your browser’s print dialog — choose “Save as PDF”. Word export is available from the Basic plan.',
      ],
      [
        'Can I restore an older version?',
        'Yes. Versions are saved automatically (at most every 10 minutes) and whenever you choose “Save version”. Open History in the editor to restore one.',
      ],
    ],
  ],
  [
    'Opportunities and matching',
    [
      [
        'What does “Eligible based on available profile” mean?',
        'No stated requirement fails based on the facts in your profile. It is not a guarantee — always read the official notice.',
      ],
      [
        'Why is a score blank?',
        'If your profile does not contain enough information to score an opportunity fairly, we leave it blank instead of guessing. Add skills, fields or service lines to improve it.',
      ],
      [
        'What is an “aggregator only” listing?',
        'It was found on a job board that collects listings from elsewhere, and we have not confirmed the original posting. Prefer applying through the employer’s own site.',
      ],
      [
        'How often are opportunities refreshed?',
        'Automated sources are checked every six hours by default. Each listing shows when it was last checked.',
      ],
    ],
  ],
  [
    'Payments',
    [
      [
        'How do I pay?',
        'Choose a plan on the Billing page. Payments are processed by our payment provider; your plan activates only after the provider confirms the payment to our server.',
      ],
      [
        'Does my plan renew automatically?',
        'No. Each payment covers one month. You can pay again at any time; time is added to your current period.',
      ],
    ],
  ],
];

export default function Help() {
  return (
    <section className="py-14">
      <div className="container-page max-w-3xl">
        <h1 className="text-[36px] font-extrabold sm:text-[44px]">Help centre</h1>
        <p className="mt-3 text-lg text-ink-600">
          Can’t find an answer?{' '}
          <Link to="/contact" className="link">
            Contact us
          </Link>
          .
        </p>
        {SECTIONS.map(([title, items]) => (
          <div key={title} className="mt-10">
            <h2 className="text-xl font-bold">{title}</h2>
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
