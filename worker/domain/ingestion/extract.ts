/**
 * Heuristic requirement extraction from plain text. Conservative by design: it only records a
 * requirement when explicit wording is present, and results are labelled "heuristic" so matching
 * lowers confidence and the UI tells users to confirm on the official page.
 */
import type { EducationLevel } from '../../../shared/constants';
import type { Requirements } from '../../../shared/schemas';

const SKILLS = [
  'python',
  'sql',
  'excel',
  'stata',
  'spss',
  'power bi',
  'tableau',
  'javascript',
  'typescript',
  'react',
  'node.js',
  'java',
  'c#',
  '.net',
  'php',
  'laravel',
  'django',
  'aws',
  'azure',
  'gcp',
  'docker',
  'kubernetes',
  'linux',
  'git',
  'machine learning',
  'data analysis',
  'data science',
  'statistics',
  'gis',
  'arcgis',
  'qgis',
  'dhis2',
  'odk',
  'kobo',
  'monitoring and evaluation',
  'm&e',
  'project management',
  'financial management',
  'accounting',
  'auditing',
  'procurement',
  'supply chain',
  'logistics',
  'grant management',
  'proposal writing',
  'report writing',
  'research',
  'public health',
  'epidemiology',
  'nursing',
  'clinical',
  'pharmacy',
  'nutrition',
  'wash',
  'agriculture',
  'agronomy',
  'civil engineering',
  'electrical engineering',
  'mechanical engineering',
  'autocad',
  'quantity surveying',
  'construction',
  'renewable energy',
  'solar',
  'teaching',
  'curriculum development',
  'training',
  'facilitation',
  'communications',
  'marketing',
  'digital marketing',
  'social media',
  'sales',
  'customer service',
  'human resources',
  'payroll',
  'legal',
  'policy analysis',
  'advocacy',
  'gender',
  'child protection',
  'livelihoods',
  'microfinance',
  'quickbooks',
  'sage',
  'erp',
  'sap',
  'salesforce',
  'figma',
  'ui/ux',
  'graphic design',
  'photography',
  'video editing',
  'cybersecurity',
  'networking',
  'it support',
  'database administration',
  'mobile development',
  'flutter',
  'android',
];

const LANGS = [
  'English',
  'French',
  'Swahili',
  'Kiswahili',
  'Luganda',
  'Arabic',
  'Portuguese',
  'Spanish',
  'German',
  'Amharic',
];

const COUNTRY_WORDS: Record<string, string> = {
  ugandan: 'Uganda',
  uganda: 'Uganda',
  kenyan: 'Kenya',
  kenya: 'Kenya',
  tanzanian: 'Tanzania',
  tanzania: 'Tanzania',
  rwandan: 'Rwanda',
  rwanda: 'Rwanda',
  burundian: 'Burundi',
  burundi: 'Burundi',
  'south sudanese': 'South Sudan',
  'south sudan': 'South Sudan',
  ethiopian: 'Ethiopia',
  ethiopia: 'Ethiopia',
  african: 'Africa',
  africa: 'Africa',
  'east african': 'East Africa',
  'east africa': 'East Africa',
  'sub-saharan africa': 'Africa',
  'eac partner states': 'East Africa',
  'developing countries': 'Developing countries',
  commonwealth: 'Commonwealth',
};

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function extractRequirements(text: string, opts: { category?: string } = {}): Partial<Requirements> {
  const t = ` ${text.replace(/\s+/g, ' ')} `;
  const lower = t.toLowerCase();
  const r: Partial<Requirements> = {};

  // Experience
  const exp = [
    ...lower.matchAll(
      /(?:minimum of|at least|min\.?|over)?\s*(\d{1,2})\s*\+?\s*(?:\(\w+\)\s*)?(?:years?|yrs)'?\s+(?:of\s+)?(?:relevant\s+|professional\s+|progressive\s+|post[- ]qualification\s+|working\s+|work\s+)*(?:experience|work)/g,
    ),
  ];
  if (exp.length) {
    const vals = exp.map((m) => Number(m[1])).filter((n) => n > 0 && n <= 30);
    if (vals.length) r.min_experience_years = Math.min(...vals);
  }

  // Education (lowest explicitly required level)
  const levels: Array<[EducationLevel, RegExp]> = [
    ['phd', /\b(ph\.?d|doctorate|doctoral degree)\b/],
    ['master', /\b(master'?s?|msc|m\.sc|mba|mph|ma degree|postgraduate degree)\b/],
    ['bachelor', /\b(bachelor'?s?|bsc|b\.sc|undergraduate degree|university degree|first degree)\b/],
    ['diploma', /\bdiploma\b/],
  ];
  if (opts.category !== 'scholarship' && opts.category !== 'fellowship') {
    const found = levels.filter(([, re]) => re.test(lower)).map(([l]) => l);
    if (found.length && /(degree|qualification|education|required|must have|holder of|minimum)/.test(lower)) {
      const order: EducationLevel[] = ['diploma', 'bachelor', 'master', 'phd'];
      r.education_level = order.find((l) => found.includes(l)) ?? null;
    }
  } else {
    const dl: Requirements['degree_levels'] = [];
    if (/\b(master'?s?|msc|postgraduate)\b/.test(lower)) dl.push('master');
    if (/\b(ph\.?d|doctoral)\b/.test(lower)) dl.push('phd');
    if (/\bpost-?doc(toral)?\b/.test(lower)) dl.push('postdoc');
    if (/\b(undergraduate|bachelor'?s?)\b/.test(lower) && /(scholarship|study)/.test(lower))
      dl.push('bachelor');
    if (dl.length) r.degree_levels = dl;
    if (/fully[- ]funded|full scholarship|full tuition and (living|stipend)/.test(lower)) r.funding = 'full';
    else if (/partial(ly)?[- ]funded|partial scholarship|tuition waiver/.test(lower)) r.funding = 'partial';
    const gpa = lower.match(
      /(?:gpa|cgpa|grade point average)\s*(?:of)?\s*(?:at least|minimum|min\.?|of)?\s*(\d(?:\.\d{1,2})?)\s*(?:\/|out of)?\s*(\d(?:\.\d)?)?/,
    );
    if (gpa) {
      const v = Number(gpa[1]);
      const scale = gpa[2] ? Number(gpa[2]) : v <= 4 ? 4 : 5;
      if (v > 0 && v <= scale) {
        r.min_gpa = v;
        r.gpa_scale = scale;
      }
    }
  }

  // Skills
  const skills = SKILLS.filter((s) => new RegExp(`[^a-z0-9]${esc(s)}[^a-z0-9]`).test(lower));
  if (skills.length) r.skills = skills.slice(0, 20);

  // Languages
  const langs = LANGS.filter((l) =>
    new RegExp(
      `(fluen\\w*|proficien\\w*|command|written and spoken|spoken and written|knowledge)[^.]{0,40}\\b${l.toLowerCase()}\\b|\\b${l.toLowerCase()}\\b[^.]{0,25}(fluen\\w*|proficien\\w*|required|essential)`,
    ).test(lower),
  );
  if (langs.length) r.languages = langs.map((l) => (l === 'Kiswahili' ? 'Swahili' : l));

  // Nationality / eligible countries — only from explicit restriction wording.
  const elig = new Set<string>();
  for (const m of lower.matchAll(
    /(?:open (?:only )?to|only|eligible (?:applicants|candidates) (?:are|must be)|restricted to|applicants (?:must be|from)|citizens of|nationals of|for)\s+((?:[a-z-]+\s){0,3}?)(nationals?|citizens?|residents?|applicants|countries)/g,
  )) {
    const phrase = m[1].trim();
    for (const [w, c] of Object.entries(COUNTRY_WORDS))
      if (phrase === w || phrase.endsWith(' ' + w)) elig.add(c);
  }
  for (const m of lower.matchAll(
    /(?:nationals|citizens|residents) of ([a-z ,-]{3,80}?)(?:\.|;| who | are | may |$)/g,
  )) {
    for (const [w, c] of Object.entries(COUNTRY_WORDS))
      if (new RegExp(`\\b${esc(w)}\\b`).test(m[1])) elig.add(c);
  }
  if (elig.size) r.eligible_countries = [...elig];

  // Business / procurement
  if (
    /certificate of (incorporation|registration)|registered (company|firm|business|entity)|duly registered|legally registered/.test(
      lower,
    )
  )
    r.registration_required = true;
  if (/tax clearance|tax compliance certificate/.test(lower)) r.tax_clearance_required = true;
  const certs: string[] = [];
  if (/\bppda\b[^.]{0,40}(register|provider)|register of providers/.test(lower))
    certs.push('PPDA register of providers');
  for (const m of t.matchAll(/\bISO\s?(\d{4,5})(?::\d{4})?/g)) certs.push(`ISO ${m[1]}`);
  if (/\bnema\b/.test(lower) && /certif|licen|approv/.test(lower)) certs.push('NEMA certification');
  if (/\buganda national bureau of standards|\bunbs\b/.test(lower)) certs.push('UNBS certification');
  if (certs.length) r.certifications = [...new Set(certs)];
  const lic: string[] = [];
  if (/trading licen[cs]e/.test(lower)) lic.push('Trading licence');
  if (/\bnational drug authority|\bnda licen/.test(lower)) lic.push('NDA licence');
  if (/\buganda registration services bureau|\bursb\b/.test(lower)) lic.push('URSB registration');
  if (lic.length) r.licenses = lic;
  const turnover = t.match(
    /(?:average )?annual turnover[^.]{0,60}?(?:UGX|Ush|USh|Shs\.?)\s?([\d,]+(?:\.\d+)?)\s*(million|billion|m|bn)?/i,
  );
  if (turnover) {
    let n = Number(turnover[1].replace(/,/g, ''));
    const unit = (turnover[2] ?? '').toLowerCase();
    if (unit.startsWith('m')) n *= 1e6;
    if (unit.startsWith('b')) n *= 1e9;
    if (n > 0) r.min_turnover_ugx = n;
  } else if (/annual turnover/.test(lower)) {
    r.notes = [
      ...(r.notes ?? []),
      'A minimum annual turnover is stated (currency not UGX) — see the official notice.',
    ];
  }
  const past = lower.match(
    /(?:at least|minimum of|a minimum of)\s*(\w+)\s*\(?\d?\)?\s*(?:similar|comparable)\s*(?:contracts|assignments|projects)/,
  );
  if (past) {
    const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
    const n = Number(past[1]) || words[past[1]] || 0;
    if (n > 0) r.min_past_contracts = n;
  }
  const years = lower.match(
    /(?:in (?:operation|business|existence) for|been operating for|existence of) (?:at least |a minimum of )?(\d{1,2}) years/,
  );
  if (years) r.min_years_in_operation = Number(years[1]);

  // Applicant type
  if (/individual consultants?\b|\bindividual consultant selection\b/.test(lower))
    r.applicant_type = 'individual';
  else if (
    /consulting firms|firms? (are|is) invited|eligible (firms|bidders)|bidders|joint venture|consortium/.test(
      lower,
    )
  )
    r.applicant_type = 'business';

  const docs: string[] = [];
  for (const [re, label] of [
    [/\bcurriculum vitae\b|\bcv\b/, 'CV'],
    [/cover(ing)? letter|motivation letter|letter of motivation/, 'Cover / motivation letter'],
    [/transcripts?/, 'Academic transcripts'],
    [/recommendation letters?|letters? of recommendation|referee/, 'Recommendation letters'],
    [/research proposal/, 'Research proposal'],
    [/bid security|bid-securing declaration/, 'Bid security / bid-securing declaration'],
    [/power of attorney/, 'Power of attorney'],
  ] as Array<[RegExp, string]>)
    if (re.test(lower)) docs.push(label);
  if (docs.length) r.required_documents = docs;
  return r;
}
