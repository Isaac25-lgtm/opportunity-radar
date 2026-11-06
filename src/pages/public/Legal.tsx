const UPDATED = '6 November 2026';

const PRIVACY: Array<[string, string[]]> = [
  [
    'Who we are',
    [
      'Opportunity Radar is an online service that helps people and businesses in Uganda and East Africa find and apply for opportunities. This notice explains what personal data we process and why. It is written with the Uganda Data Protection and Privacy Act, 2019 in mind; it has not yet been reviewed by a lawyer, and we will update it after legal review.',
    ],
  ],
  [
    'What we collect',
    [
      'Account data: your name, email address, password (stored only as a salted hash) and timezone.',
      'Profile data you choose to enter: work history, education, skills, preferences, academic records, and business details such as registration status, services and turnover band.',
      'Documents you upload (CVs, company profiles, transcripts, certificates). These are stored privately and are only downloadable by you.',
      'Usage records: saved and dismissed opportunities, tracked applications, notifications, plan and payment status. We do not store card or mobile-money details — those are handled by our payment provider.',
    ],
  ],
  [
    'Why we use it',
    [
      'To provide the service you asked for: building CVs, matching your profiles to opportunities, and sending the alerts you enable.',
      'To check published eligibility criteria. Nationality and residency are used only for this.',
      'To secure the service, prevent abuse and keep audit records of administrative actions.',
    ],
  ],
  [
    'Who we share it with',
    [
      'We do not sell your data and do not share your CV or documents with employers or any third party.',
      'Service providers process data on our behalf: Cloudflare (hosting, database and storage), our email provider (alerts, when enabled) and our payment provider (payments, when enabled).',
      'AI features are not currently enabled. If they are introduced, we will update this notice, send the minimum data needed, and never send another user’s data.',
    ],
  ],
  [
    'Your rights and choices',
    [
      'Download a copy of your data from Settings → Export my data.',
      'Correct your data at any time by editing your profiles and CVs.',
      'Delete individual documents, profiles or CVs, or permanently delete your account from Settings. Payment records are kept in anonymised form where required for accounting.',
      'Turn email alerts off or change their frequency in Settings.',
    ],
  ],
  [
    'Retention',
    [
      'We keep your data while your account is active. When you delete your account we remove your profiles, CVs, documents, applications and notifications immediately. Server logs that contain no document contents are kept for a limited period for security.',
    ],
  ],
  ['Contact', ['Use the contact form and choose “Privacy / my data”.']],
];

const TERMS: Array<[string, string[]]> = [
  [
    'Using Opportunity Radar',
    [
      'You must provide accurate information and keep your password secure. You are responsible for what you submit to employers, funders and procuring entities.',
    ],
  ],
  [
    'No guarantees',
    [
      'We collect opportunities from official sources, recognised platforms and administrator-verified listings, but we cannot guarantee that a listing is accurate, complete or still open. Always confirm details on the official notice before applying.',
      'Match scores and eligibility labels are guidance based on the information available. They are not a decision by the employer, funder or procuring entity and do not guarantee selection.',
    ],
  ],
  [
    'Truthful content',
    [
      'The CV builder will not invent facts, and you must not use it to misrepresent your qualifications, experience, business records, certificates or past performance.',
    ],
  ],
  [
    'Plans and payments',
    [
      'Paid plans last one month from confirmation of payment and do not renew automatically. Plan features are listed on the pricing page and may change with notice. Refunds are considered case by case through the contact form.',
    ],
  ],
  [
    'Acceptable use',
    [
      'Do not attempt to access other users’ data, scrape the service, upload malicious files, or use the service for unlawful purposes. We may suspend accounts that do.',
    ],
  ],
  ['Changes', ['We may update these terms and will show the date of the latest version on this page.']],
];

export default function Legal({ kind }: { kind: 'privacy' | 'terms' }) {
  const sections = kind === 'privacy' ? PRIVACY : TERMS;
  return (
    <section className="py-14">
      <article className="container-page max-w-3xl">
        <h1 className="text-[34px] font-extrabold sm:text-[42px]">
          {kind === 'privacy' ? 'Privacy policy' : 'Terms of use'}
        </h1>
        <p className="mt-2 text-sm text-ink-500">Last updated {UPDATED}</p>
        {sections.map(([h, ps]) => (
          <section key={h} className="mt-8">
            <h2 className="text-xl font-bold">{h}</h2>
            {ps.length > 1 ? (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-700">
                {ps.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[15px] leading-relaxed text-ink-700">{ps[0]}</p>
            )}
          </section>
        ))}
      </article>
    </section>
  );
}
