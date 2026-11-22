import { EDUCATION_LABELS, EDUCATION_LEVELS, type ProfileType } from '../../../shared/constants';
import { TURNOVER_BANDS } from '../../../shared/schemas';
import {
  BUSINESS_CERTIFICATIONS,
  BUSINESS_SECTORS,
  BUYERS,
  CERTIFICATIONS,
  COUNTRY_NAMES,
  FIELDS_OF_STUDY,
  INDUSTRIES,
  JOB_TITLES,
  PLACE_CHOICES,
  LANGUAGES,
  LANGUAGE_TESTS,
  LICENCES,
  PRODUCTS,
  RESEARCH_INTERESTS,
  SERVICE_LINES,
  SKILLS,
  SUPPLIER_CLASSIFICATIONS,
  displayCountry,
  suggestAcademic,
  suggestBusiness,
  suggestCareer,
  suggestWhere,
} from '../../../shared/suggestions';
import type { SectionDef } from '../../components/FormBuilder';

const eduOpts = EDUCATION_LEVELS.map((l) => ({ value: l, label: EDUCATION_LABELS[l] }));
const WHERE_HINT =
  'Choose Worldwide, one or more regions, or specific countries. You can change this at any time.';
const langItem = [
  { key: 'name', label: 'Language', type: 'text' as const, vocab: LANGUAGES },
  {
    key: 'level',
    label: 'Level',
    type: 'select' as const,
    options: ['Native', 'Fluent', 'Professional', 'Conversational', 'Basic'].map((v) => ({
      value: v,
      label: v,
    })),
  },
  {
    key: 'test',
    label: 'Test (if any)',
    type: 'text' as const,
    placeholder: 'e.g. IELTS, TOEFL, DELF',
    vocab: LANGUAGE_TESTS,
  },
  { key: 'score', label: 'Score', type: 'text' as const },
];

export const PROFILE_META: Record<ProfileType, { title: string; blurb: string }> = {
  career: {
    title: 'Career profile',
    blurb: 'Jobs, internships, graduate programmes, fellowships and individual consultancies.',
  },
  academic: {
    title: 'Academic profile',
    blurb: 'Scholarships, Master’s and PhD places, research grants and fellowships.',
  },
  business: {
    title: 'Business profile',
    blurb: 'Tenders, RFPs, RFQs, EOIs, supplier registration and business grants.',
  },
};

export const PROFILE_SECTIONS: Record<ProfileType, SectionDef[]> = {
  career: [
    {
      title: 'Where should we look?',
      description: WHERE_HINT,
      fields: [
        {
          key: 'preferred_countries',
          label: 'Where do you want opportunities from?',
          type: 'tags',
          placeholder: 'e.g. Worldwide, Europe, Canada',
          vocab: [...PLACE_CHOICES, 'Remote'],
          suggest: ({ data }) =>
            suggestWhere(data.preferred_countries, data.country || data.nationality, { remote: true }),
        },
      ],
    },
    {
      title: 'About you',
      description: 'Used for matching and to pre-fill your CV.',
      fields: [
        {
          key: 'headline',
          label: 'Professional headline',
          type: 'text',
          placeholder: 'e.g. Accountant, Software developer',
          vocab: JOB_TITLES,
          suggest: ({ data }) => suggestCareer.headline(data),
        },
        {
          key: 'location',
          label: 'City / town',
          type: 'text',
          placeholder: 'e.g. São Paulo, London, Manila',
        },
        { key: 'country', label: 'Country of residence', type: 'text', vocab: COUNTRY_NAMES },
        {
          key: 'nationality',
          label: 'Nationality',
          type: 'text',
          hint: 'Only used to check published eligibility rules.',
          vocab: COUNTRY_NAMES,
          suggest: ({ data }) => (data.country ? [displayCountry(data.country)] : []),
        },
        {
          key: 'summary',
          label: 'Summary',
          type: 'textarea',
          hint: 'Two to four sentences about your experience and what you are looking for.',
        },
      ],
    },
    {
      title: 'What you are looking for',
      fields: [
        {
          key: 'target_titles',
          label: 'Target roles',
          type: 'tags',
          placeholder: 'e.g. Data analyst',
          hint: 'Role titles you would apply for.',
          vocab: JOB_TITLES,
          suggest: ({ data }) => suggestCareer.targetTitles(data),
        },
        {
          key: 'industries',
          label: 'Industries',
          type: 'tags',
          placeholder: 'e.g. Health, Banking, NGO',
          vocab: INDUSTRIES,
          suggest: ({ data }) => suggestCareer.industries(data),
        },
        {
          key: 'seniority',
          label: 'Seniority',
          type: 'select',
          options: [
            { value: 'entry', label: 'Entry level' },
            { value: 'mid', label: 'Mid level' },
            { value: 'senior', label: 'Senior' },
            { value: 'executive', label: 'Executive' },
          ],
        },
        {
          key: 'salary_expectation',
          label: 'Salary expectation (optional)',
          type: 'text',
          placeholder: 'e.g. USD 1,500 / month',
        },
        {
          key: 'employment_types',
          label: 'Employment types',
          type: 'chips',
          options: [
            { value: 'full_time', label: 'Full-time' },
            { value: 'part_time', label: 'Part-time' },
            { value: 'contract', label: 'Contract' },
            { value: 'internship', label: 'Internship' },
            { value: 'consultancy', label: 'Consultancy' },
            { value: 'volunteer', label: 'Volunteer' },
          ],
        },
        {
          key: 'work_modes',
          label: 'Work mode',
          type: 'chips',
          options: [
            { value: 'onsite', label: 'On-site' },
            { value: 'hybrid', label: 'Hybrid' },
            { value: 'remote', label: 'Remote' },
          ],
        },
        { key: 'excluded_locations', label: 'Locations to exclude', type: 'tags', vocab: COUNTRY_NAMES },
      ],
    },
    {
      title: 'Skills and languages',
      fields: [
        {
          key: 'skills',
          label: 'Skills',
          type: 'tags',
          vocab: SKILLS,
          suggest: ({ data }) => suggestCareer.skills(data),
          hint: 'Add at least five. Matching compares these with each opportunity.',
        },
        {
          key: 'languages',
          label: 'Languages',
          type: 'list',
          itemFields: langItem,
          itemTitle: (i) => [i.name, i.level].filter(Boolean).join(' — '),
          addLabel: 'Add language',
          blank: { name: '', level: '', test: '', score: '' },
        },
      ],
    },
    {
      title: 'Experience',
      fields: [
        {
          key: 'years_experience',
          label: 'Total years of experience (optional)',
          type: 'number',
          min: 0,
          max: 60,
          hint: 'Leave blank to calculate from your work history.',
        },
        {
          key: 'experience',
          label: 'Work history',
          type: 'list',
          addLabel: 'Add employment',
          blank: {
            title: '',
            employer: '',
            location: '',
            start: '',
            end: '',
            current: false,
            description: '',
          },
          itemTitle: (i) => [i.title, i.employer].filter(Boolean).join(' at '),
          itemFields: [
            { key: 'title', label: 'Job title', type: 'text', vocab: JOB_TITLES },
            { key: 'employer', label: 'Employer', type: 'text' },
            { key: 'start', label: 'Start', type: 'month' },
            { key: 'end', label: 'End', type: 'month' },
            { key: 'location', label: 'Location', type: 'text' },
            { key: 'current', label: 'I currently work here', type: 'checkbox' },
            {
              key: 'description',
              label: 'Responsibilities and results',
              type: 'textarea',
              hint: 'Start lines with “-” for bullet points. Include numbers only if they are accurate.',
            },
          ],
        },
      ],
    },
    {
      title: 'Education and credentials',
      fields: [
        { key: 'highest_education', label: 'Highest education level', type: 'select', options: eduOpts },
        {
          key: 'education',
          label: 'Education',
          type: 'list',
          addLabel: 'Add education',
          blank: {
            qualification: '',
            level: null,
            field: '',
            institution: '',
            country: '',
            start: '',
            end: '',
            grade: '',
          },
          itemTitle: (i) => [i.qualification, i.institution].filter(Boolean).join(', '),
          itemFields: [
            {
              key: 'qualification',
              label: 'Qualification',
              type: 'text',
              placeholder: 'e.g. BSc Statistics',
            },
            { key: 'level', label: 'Level', type: 'select', options: eduOpts },
            { key: 'field', label: 'Field of study', type: 'text', vocab: FIELDS_OF_STUDY },
            { key: 'institution', label: 'Institution', type: 'text' },
            { key: 'country', label: 'Country', type: 'text', vocab: COUNTRY_NAMES },
            { key: 'grade', label: 'Grade / class', type: 'text' },
            { key: 'start', label: 'Start', type: 'month' },
            { key: 'end', label: 'End', type: 'month' },
          ],
        },
        {
          key: 'certifications',
          label: 'Certifications',
          type: 'list',
          addLabel: 'Add certification',
          blank: { name: '', issuer: '', year: '' },
          itemTitle: (i) => i.name,
          itemFields: [
            {
              key: 'name',
              label: 'Name',
              type: 'text',
              vocab: CERTIFICATIONS,
              suggest: ({ data }) => suggestCareer.certifications(data),
            },
            { key: 'issuer', label: 'Issuer', type: 'text' },
            { key: 'year', label: 'Year', type: 'year' },
          ],
        },
        {
          key: 'projects',
          label: 'Projects',
          type: 'list',
          addLabel: 'Add project',
          blank: { name: '', description: '', link: '' },
          itemTitle: (i) => i.name,
          itemFields: [
            { key: 'name', label: 'Project', type: 'text' },
            { key: 'link', label: 'Link', type: 'text' },
            { key: 'description', label: 'Description', type: 'textarea' },
          ],
        },
        {
          key: 'memberships',
          label: 'Professional memberships',
          type: 'list',
          addLabel: 'Add membership',
          blank: { name: '', role: '' },
          itemTitle: (i) => i.name,
          itemFields: [
            { key: 'name', label: 'Organisation', type: 'text' },
            { key: 'role', label: 'Role', type: 'text' },
          ],
        },
      ],
    },
  ],
  academic: [
    {
      title: 'Where should we look?',
      description: WHERE_HINT,
      fields: [
        {
          key: 'preferred_countries',
          label: 'Where do you want to study?',
          type: 'tags',
          placeholder: 'e.g. Worldwide, Europe, Canada',
          vocab: PLACE_CHOICES,
          suggest: ({ data }) =>
            suggestWhere(data.preferred_countries, data.residence_country || data.nationality),
        },
      ],
    },
    {
      title: 'Academic background',
      fields: [
        { key: 'current_level', label: 'Highest qualification held', type: 'select', options: eduOpts },
        {
          key: 'field_of_study',
          label: 'Field of study',
          type: 'text',
          vocab: FIELDS_OF_STUDY,
          suggest: ({ data }) => suggestAcademic.fieldOfStudy(data),
        },
        {
          key: 'qualifications',
          label: 'Qualifications',
          type: 'list',
          addLabel: 'Add qualification',
          blank: {
            qualification: '',
            level: null,
            field: '',
            institution: '',
            country: '',
            year: '',
            classification: '',
            gpa: null,
            gpa_scale: null,
          },
          itemTitle: (i) => [i.qualification, i.institution, i.year].filter(Boolean).join(', '),
          itemFields: [
            { key: 'qualification', label: 'Qualification', type: 'text' },
            { key: 'level', label: 'Level', type: 'select', options: eduOpts },
            { key: 'field', label: 'Field', type: 'text', vocab: FIELDS_OF_STUDY },
            { key: 'institution', label: 'Institution', type: 'text' },
            { key: 'country', label: 'Country', type: 'text', vocab: COUNTRY_NAMES },
            { key: 'year', label: 'Year completed', type: 'year' },
            {
              key: 'classification',
              label: 'Classification',
              type: 'text',
              placeholder: 'e.g. Second Class Upper',
            },
            { key: 'gpa', label: 'GPA / CGPA', type: 'number', min: 0, max: 10, step: 0.01 },
            {
              key: 'gpa_scale',
              label: 'GPA scale',
              type: 'number',
              min: 1,
              max: 10,
              placeholder: '5',
              hint: 'The maximum on your university’s scale, e.g. 4.0 or 5.0',
            },
          ],
        },
      ],
    },
    {
      title: 'Research and goals',
      fields: [
        {
          key: 'target_levels',
          label: 'What are you applying for?',
          type: 'chips',
          options: [
            { value: 'bachelor', label: "Bachelor's" },
            { value: 'master', label: "Master's" },
            { value: 'phd', label: 'PhD' },
            { value: 'postdoc', label: 'Postdoc' },
            { value: 'short_course', label: 'Short course' },
            { value: 'exchange', label: 'Exchange' },
          ],
        },
        {
          key: 'target_fields',
          label: 'Target fields',
          type: 'tags',
          vocab: FIELDS_OF_STUDY,
          suggest: ({ data }) => suggestAcademic.targetFields(data),
        },
        {
          key: 'research_interests',
          label: 'Research interests',
          type: 'tags',
          vocab: RESEARCH_INTERESTS,
          suggest: ({ data }) => suggestAcademic.researchInterests(data),
        },
        {
          key: 'target_programmes',
          label: 'Target programmes',
          type: 'tags',
          suggest: ({ data }) => suggestAcademic.targetProgrammes(data),
        },
        { key: 'proposed_research', label: 'Proposed research area (optional)', type: 'textarea' },
        { key: 'research_experience', label: 'Research experience', type: 'textarea' },
        { key: 'work_experience_years', label: 'Years of work experience', type: 'number', min: 0, max: 60 },
      ],
    },
    {
      title: 'Eligibility details',
      description:
        'Many scholarships restrict who can apply. These details are used only to check published criteria.',
      fields: [
        { key: 'nationality', label: 'Nationality', type: 'text', vocab: COUNTRY_NAMES },
        {
          key: 'residence_country',
          label: 'Country of residence',
          type: 'text',
          vocab: COUNTRY_NAMES,
          suggest: ({ data }) => (data.nationality ? [displayCountry(data.nationality)] : []),
        },
        {
          key: 'languages',
          label: 'Language qualifications',
          type: 'list',
          itemFields: langItem,
          itemTitle: (i) => [i.name, i.test, i.score].filter(Boolean).join(' — '),
          addLabel: 'Add language',
          blank: { name: '', level: '', test: '', score: '' },
        },
      ],
    },
    {
      title: 'Destinations and funding',
      fields: [
        { key: 'preferred_institutions', label: 'Preferred institutions', type: 'tags' },
        {
          key: 'funding_need',
          label: 'Funding needed',
          type: 'select',
          options: [
            { value: 'full', label: 'Full funding' },
            { value: 'partial', label: 'Partial funding' },
            { value: 'any', label: 'Any / self-funded' },
          ],
        },
        { key: 'accepts_partial', label: 'Would you accept partial funding?', type: 'tristate' },
      ],
    },
    {
      title: 'Achievements',
      fields: [
        {
          key: 'publications',
          label: 'Publications',
          type: 'list',
          addLabel: 'Add publication',
          blank: { title: '', venue: '', year: '' },
          itemTitle: (i) => i.title,
          itemFields: [
            { key: 'title', label: 'Title', type: 'text', wide: true },
            { key: 'venue', label: 'Journal / venue', type: 'text' },
            { key: 'year', label: 'Year', type: 'year' },
          ],
        },
        {
          key: 'awards',
          label: 'Awards',
          type: 'list',
          addLabel: 'Add award',
          blank: { title: '', year: '' },
          itemTitle: (i) => i.title,
          itemFields: [
            { key: 'title', label: 'Award', type: 'text' },
            { key: 'year', label: 'Year', type: 'year' },
          ],
        },
      ],
    },
  ],
  business: [
    {
      title: 'Where should we look?',
      description: WHERE_HINT,
      fields: [
        {
          key: 'preferred_geographies',
          label: 'Where do you want to win contracts?',
          type: 'tags',
          placeholder: 'e.g. Worldwide, Middle East, Brazil',
          vocab: PLACE_CHOICES,
          suggest: ({ data }) => suggestWhere(data.preferred_geographies, data.registration_country),
        },
      ],
    },
    {
      title: 'Company',
      fields: [
        { key: 'registered_name', label: 'Registered company name', type: 'text' },
        { key: 'trading_name', label: 'Trading name', type: 'text' },
        { key: 'is_registered', label: 'Is the business legally registered?', type: 'tristate' },
        {
          key: 'registration_country',
          label: 'Country of registration',
          type: 'text',
          placeholder: 'e.g. Germany, India, Brazil',
          vocab: COUNTRY_NAMES,
        },
        { key: 'registration_number', label: 'Registration number (optional)', type: 'text' },
        { key: 'year_established', label: 'Year established', type: 'number', min: 1900, max: 2100 },
        { key: 'description', label: 'Business description', type: 'textarea' },
        {
          key: 'operating_locations',
          label: 'Operating locations',
          type: 'tags',
          vocab: COUNTRY_NAMES,
          suggest: ({ data }) =>
            data.registration_country ? [displayCountry(data.registration_country)] : [],
        },
      ],
    },
    {
      title: 'What you supply',
      fields: [
        {
          key: 'procurement_categories',
          label: 'Procurement categories',
          type: 'chips',
          options: [
            { value: 'works', label: 'Works' },
            { value: 'goods', label: 'Goods / supplies' },
            { value: 'services', label: 'Non-consulting services' },
            { value: 'consultancy', label: 'Consultancy (firm)' },
          ],
        },
        {
          key: 'service_lines',
          label: 'Service lines',
          type: 'tags',
          placeholder: 'e.g. Road construction, IT support',
          hint: 'Suggestions follow your business description and sectors.',
          vocab: SERVICE_LINES,
          suggest: ({ data }) => suggestBusiness.serviceLines(data),
        },
        {
          key: 'products_services',
          label: 'Products and services',
          type: 'tags',
          placeholder: 'e.g. Medical equipment, Stationery',
          vocab: PRODUCTS,
          suggest: ({ data }) => suggestBusiness.products(data),
        },
        {
          key: 'industries',
          label: 'Sectors',
          type: 'tags',
          placeholder: 'e.g. Construction, Technology',
          vocab: BUSINESS_SECTORS,
          suggest: ({ data }) => suggestBusiness.industries(data),
        },
      ],
    },
    {
      title: 'Capacity and track record',
      description:
        'Disclose only what you are comfortable with. Requirements you have not evidenced are flagged — never assumed.',
      fields: [
        {
          key: 'turnover_band',
          label: 'Annual turnover band',
          type: 'select',
          options: Object.entries(TURNOVER_BANDS).map(([value, b]) => ({ value, label: b.label })),
        },
        { key: 'staff_count', label: 'Number of staff', type: 'number', min: 0 },
        {
          key: 'past_contracts',
          label: 'Past contracts',
          type: 'list',
          addLabel: 'Add past contract',
          blank: { title: '', client: '', year: '', value_band: '', description: '' },
          itemTitle: (i) => [i.title, i.client, i.year].filter(Boolean).join(', '),
          itemFields: [
            { key: 'title', label: 'Contract', type: 'text' },
            { key: 'client', label: 'Client', type: 'text' },
            { key: 'year', label: 'Year', type: 'year' },
            { key: 'value_band', label: 'Value (optional)', type: 'text' },
            { key: 'description', label: 'Scope', type: 'textarea' },
          ],
        },
      ],
    },
    {
      title: 'Compliance',
      fields: [
        {
          key: 'certifications',
          label: 'Certifications and accreditations',
          type: 'tags',
          vocab: BUSINESS_CERTIFICATIONS,
          suggest: ({ data }) => suggestBusiness.certifications(data),
        },
        {
          key: 'licenses',
          label: 'Licences',
          type: 'tags',
          vocab: LICENCES,
          suggest: ({ data }) => suggestBusiness.licences(data),
        },
        {
          key: 'tax_compliance',
          label: 'Tax clearance status',
          type: 'select',
          options: [
            { value: 'valid', label: 'Valid tax clearance' },
            { value: 'expired', label: 'Expired' },
            { value: 'unknown', label: 'Not sure' },
          ],
          placeholder: undefined,
        },
        {
          key: 'supplier_classifications',
          label: 'Supplier classifications (if relevant to tenders)',
          type: 'tags',
          hint: 'For example women-owned or youth-owned, only if a tender asks.',
          vocab: SUPPLIER_CLASSIFICATIONS,
          suggestions: SUPPLIER_CLASSIFICATIONS,
        },
      ],
    },
    {
      title: 'Preferences',
      fields: [
        { key: 'preferred_contract_min_ugx', label: 'Minimum contract size (UGX)', type: 'number', min: 0 },
        { key: 'preferred_contract_max_ugx', label: 'Maximum contract size (UGX)', type: 'number', min: 0 },
        {
          key: 'preferred_buyers',
          label: 'Preferred buyers',
          type: 'tags',
          placeholder: 'e.g. Ministries, UN agencies, NGOs',
          vocab: BUYERS,
          suggest: ({ data }) => suggestBusiness.buyers(data),
        },
        { key: 'consortium_willing', label: 'Open to consortium / joint venture bids?', type: 'tristate' },
      ],
    },
  ],
};
