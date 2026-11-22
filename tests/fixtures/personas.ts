/**
 * Fifteen fictional people (5 professionals, 5 scholarship seekers, 5 companies) and a set of fictional
 * opportunities with known right answers. Used by tests/integration/personas.test.ts and by
 * scripts/seed-sample-personas.mjs to produce sample CVs. Names, organisations and emails are invented;
 * every address uses example.com.
 *
 * Plain data only (no imports) so Node can load it directly with type stripping.
 */

export type PersonaPlan = 'basic' | 'pro' | 'elite';

export type Persona = {
  key: string;
  name: string;
  email: string;
  plan: PersonaPlan;
  kind: 'professional' | 'scholar' | 'company';
  profileType: 'career' | 'academic' | 'business';
  profile: Record<string, unknown>;
  /** Key of the opportunity this person should rank first. */
  expectTop?: string;
  /** Key of the most relevant opportunity when it is not one they can apply for. */
  expectMostRelevant?: string;
  /** Expected eligibility for specific opportunities. */
  expectEligibility?: Record<string, 'eligible' | 'potential' | 'not_eligible' | 'insufficient'>;
  /** Template for the sample CV (professionals and scholars). */
  cvTemplate?: 'modern' | 'ats' | 'academic';
};

const exp = (title: string, employer: string, location: string, start: string, end: string, description: string) => ({
  title,
  employer,
  location,
  start,
  end,
  current: !end,
  description,
}); // prettier-ignore

/* ------------------------------------------------------------------ Professionals (Jobs plan) */
const professionals: Persona[] = [
  {
    key: 'amina',
    name: 'Amina Okafor',
    email: 'amina.okafor@example.com',
    plan: 'basic',
    kind: 'professional',
    profileType: 'career',
    cvTemplate: 'modern',
    expectTop: 'job_data_analyst',
    expectEligibility: { job_data_analyst: 'eligible', job_head_chef: 'eligible' },
    profile: {
      headline: 'Senior Data Analyst',
      summary:
        'Data analyst with six years of experience turning payments and customer data into decisions. Builds SQL pipelines and Power BI dashboards used by finance and product teams across West Africa.',
      location: 'Lagos',
      country: 'Nigeria',
      nationality: 'Nigerian',
      highest_education: 'master',
      target_titles: ['Senior Data Analyst', 'Data Analyst', 'Analytics Lead'],
      industries: ['Financial services', 'Fintech'],
      seniority: 'senior',
      employment_types: ['full_time'],
      work_modes: ['hybrid', 'remote'],
      preferred_countries: ['Nigeria', 'Ghana', 'Kenya'],
      skills: ['SQL', 'Python', 'Power BI', 'Statistics', 'Data visualisation', 'Excel', 'dbt'],
      languages: [
        { name: 'English', level: 'Fluent' },
        { name: 'Igbo', level: 'Native' },
      ],
      experience: [
        exp('Senior Data Analyst', 'Kora Payments', 'Lagos', '2022-03', '', '- Built the SQL and dbt models behind daily revenue reporting for 4 markets\n- Cut month-end reconciliation from 5 days to 2 with automated Power BI checks\n- Mentor three junior analysts'),
        exp('Data Analyst', 'Sterling Micro-Finance', 'Lagos', '2019-01', '2022-02', '- Designed loan-portfolio dashboards used by the credit committee\n- Built a Python churn model that lifted retention campaigns by 12%'),
        exp('Graduate Analyst', 'Delta Consulting', 'Abuja', '2018-01', '2018-12', '- Cleaned and analysed survey data for public-sector clients'),
      ],
      education: [
        { qualification: 'MSc Data Science', level: 'master', field: 'Data Science', institution: 'University of Lagos', country: 'Nigeria', start: '2016-09', end: '2017-11', grade: 'Distinction' },
        { qualification: 'BSc Statistics', level: 'bachelor', field: 'Statistics', institution: 'University of Ibadan', country: 'Nigeria', start: '2011-09', end: '2015-07', grade: 'Second Class Upper' },
      ],
      certifications: [{ name: 'Microsoft Certified: Power BI Data Analyst Associate', issuer: 'Microsoft', year: '2021' }],
    },
  },
  {
    key: 'james',
    name: 'James Otieno',
    email: 'james.otieno@example.com',
    plan: 'basic',
    kind: 'professional',
    profileType: 'career',
    cvTemplate: 'ats',
    expectTop: 'job_resident_engineer',
    expectEligibility: { job_resident_engineer: 'eligible' },
    profile: {
      headline: 'Civil Engineer (Roads and Drainage)',
      summary:
        'Registered civil engineer with eight years designing and supervising urban roads and drainage. Led site teams of up to 60 on donor-funded projects in Nairobi and Kisumu.',
      location: 'Nairobi',
      country: 'Kenya',
      nationality: 'Kenyan',
      highest_education: 'bachelor',
      target_titles: ['Resident Engineer', 'Civil Engineer', 'Highway Engineer'],
      industries: ['Construction', 'Infrastructure'],
      seniority: 'senior',
      employment_types: ['full_time', 'contract'],
      work_modes: ['onsite'],
      preferred_countries: ['Kenya', 'Uganda', 'Tanzania'],
      skills: ['AutoCAD', 'Civil 3D', 'Road design', 'Contract supervision', 'Project management', 'Drainage design'],
      languages: [
        { name: 'English', level: 'Fluent' },
        { name: 'Swahili', level: 'Native' },
      ],
      experience: [
        exp('Assistant Resident Engineer', 'Konza Engineering Partners', 'Nairobi', '2021-02', '', '- Supervise 14 km of urban road upgrades worth $18M\n- Approve contractor method statements and monthly valuations'),
        exp('Civil Engineer', 'Lakeshore Consulting Engineers', 'Kisumu', '2017-06', '2021-01', '- Designed storm-water drainage for three county towns\n- Prepared bills of quantities and tender drawings in Civil 3D'),
        exp('Graduate Engineer', 'Rift Valley Roads Ltd', 'Nakuru', '2016-01', '2017-05', '- Site engineering on a 22 km gravel-to-bitumen upgrade'),
      ],
      education: [
        { qualification: 'BSc Civil Engineering', level: 'bachelor', field: 'Civil Engineering', institution: 'University of Nairobi', country: 'Kenya', start: '2011-09', end: '2015-12', grade: 'Second Class Upper' },
      ],
      certifications: [{ name: 'Registered Engineer', issuer: 'Engineers Board of Kenya', year: '2020' }],
      memberships: [{ name: 'Institution of Engineers of Kenya', role: 'Corporate member' }],
    },
  },
  {
    key: 'priya',
    name: 'Priya Nair',
    email: 'priya.nair@example.com',
    plan: 'basic',
    kind: 'professional',
    profileType: 'career',
    cvTemplate: 'modern',
    expectTop: 'job_me_specialist',
    expectEligibility: { job_me_specialist: 'eligible', job_programme_data_officer: 'eligible' },
    profile: {
      headline: 'Monitoring and Evaluation Specialist (Public Health)',
      summary:
        'Public health M&E specialist with nine years on HIV, malaria and maternal-health programmes. Strong on DHIS2, data quality audits and turning routine data into programme decisions.',
      location: 'Kampala',
      country: 'Uganda',
      nationality: 'Indian',
      highest_education: 'master',
      target_titles: ['M&E Specialist', 'Monitoring and Evaluation Specialist', 'Public Health Specialist'],
      industries: ['Global health', 'NGO'],
      seniority: 'senior',
      employment_types: ['full_time', 'consultancy'],
      work_modes: ['onsite', 'hybrid'],
      preferred_countries: ['Uganda', 'Kenya', 'India'],
      skills: ['Monitoring and evaluation', 'DHIS2', 'Epidemiology', 'Stata', 'Data quality assessment', 'Survey design'],
      languages: [
        { name: 'English', level: 'Fluent' },
        { name: 'Hindi', level: 'Native' },
        { name: 'Malayalam', level: 'Native' },
      ],
      experience: [
        exp('Senior M&E Officer', 'Hope for Mothers Initiative', 'Kampala', '2020-05', '', '- Run the M&E system for a 12-district maternal-health programme\n- Introduced quarterly data quality audits; reporting completeness rose from 71% to 94%'),
        exp('M&E Officer', 'Malaria Free Communities', 'Gulu', '2017-02', '2020-04', '- Managed DHIS2 tracker roll-out to 120 health facilities'),
        exp('Research Associate', 'Kerala Institute of Public Health', 'Kochi', '2015-07', '2017-01', '- Field surveys and analysis for district immunisation studies'),
      ],
      education: [
        { qualification: 'Master of Public Health', level: 'master', field: 'Public Health', institution: 'Manipal Academy of Higher Education', country: 'India', start: '2013-08', end: '2015-06', grade: 'First Class' },
        { qualification: 'Bachelor of Science, Nursing', level: 'bachelor', field: 'Nursing', institution: 'University of Kerala', country: 'India', start: '2009-08', end: '2013-05', grade: '' },
      ],
    },
  },
  {
    key: 'lucas',
    name: 'Lucas Silva',
    email: 'lucas.silva@example.com',
    plan: 'basic',
    kind: 'professional',
    profileType: 'career',
    cvTemplate: 'ats',
    expectTop: 'job_frontend',
    expectEligibility: { job_frontend: 'eligible', job_programme_data_officer: 'not_eligible' },
    profile: {
      headline: 'Senior Software Engineer (Frontend)',
      summary:
        'Frontend engineer with seven years building fast, accessible web apps in React and TypeScript for fintech and e-commerce. Comfortable owning features end to end, from API design in Node.js to AWS deployments.',
      location: 'São Paulo',
      country: 'Brazil',
      nationality: 'Brazilian',
      highest_education: 'bachelor',
      target_titles: ['Senior Frontend Engineer', 'Senior Software Engineer', 'Frontend Developer'],
      industries: ['Software', 'Fintech'],
      seniority: 'senior',
      employment_types: ['full_time', 'contract'],
      work_modes: ['remote'],
      skills: ['TypeScript', 'React', 'Node.js', 'AWS', 'PostgreSQL', 'Accessibility', 'GraphQL'],
      languages: [
        { name: 'Portuguese', level: 'Native' },
        { name: 'English', level: 'Fluent' },
        { name: 'Spanish', level: 'Intermediate' },
      ],
      experience: [
        exp('Senior Frontend Engineer', 'Pagaê', 'São Paulo (remote)', '2022-01', '', '- Lead the checkout front end serving 3M monthly users\n- Cut bundle size by 38% and raised Lighthouse accessibility to 100'),
        exp('Software Engineer', 'Loja Rápida', 'Campinas', '2018-03', '2021-12', '- Built the React design system used by 6 product teams\n- Moved image processing to AWS Lambda, saving $4k a month'),
        exp('Junior Developer', 'Agência Norte', 'São Paulo', '2017-01', '2018-02', '- Front-end work on marketing sites and dashboards'),
      ],
      education: [
        { qualification: 'BSc Computer Science', level: 'bachelor', field: 'Computer Science', institution: 'Universidade Estadual de Campinas', country: 'Brazil', start: '2012-02', end: '2016-12', grade: '' },
      ],
      projects: [{ name: 'react-a11y-table', description: 'Open-source accessible data table for React, 1.2k GitHub stars.', link: 'https://example.com/react-a11y-table' }],
    },
  },
  {
    key: 'grace',
    name: 'Grace Nakato',
    email: 'grace.nakato@example.com',
    plan: 'basic',
    kind: 'professional',
    profileType: 'career',
    cvTemplate: 'modern',
    expectTop: 'job_procurement',
    expectEligibility: { job_procurement: 'eligible' },
    profile: {
      headline: 'Procurement and Supply Chain Officer',
      summary:
        'Procurement officer with five years running public and donor-funded procurement under PPDA and World Bank rules, from planning and bidding documents to contract management.',
      location: 'Kampala',
      country: 'Uganda',
      nationality: 'Ugandan',
      highest_education: 'bachelor',
      target_titles: ['Procurement Officer', 'Procurement Specialist', 'Supply Chain Officer'],
      industries: ['Public sector', 'Utilities'],
      seniority: 'mid',
      employment_types: ['full_time'],
      work_modes: ['onsite'],
      preferred_countries: ['Uganda', 'Kenya', 'Rwanda'],
      skills: ['Procurement', 'Contract management', 'Supplier evaluation', 'PPDA regulations', 'Excel', 'Bid evaluation'],
      languages: [
        { name: 'English', level: 'Fluent' },
        { name: 'Luganda', level: 'Native' },
      ],
      experience: [
        exp('Procurement Officer', 'Kampala Water Services Board', 'Kampala', '2022-07', '', '- Run 40+ procurements a year worth UGX 9B, under PPDA rules\n- Introduced a supplier performance scorecard used in contract renewals'),
        exp('Assistant Procurement Officer', 'Mbale District Local Government', 'Mbale', '2020-08', '2022-06', '- Prepared bidding documents and minutes for the contracts committee'),
        exp('Stores Assistant', 'Nile Breweries Ltd', 'Jinja', '2019-09', '2020-07', '- Stock control and goods-received reconciliation'),
      ],
      education: [
        { qualification: 'Bachelor of Procurement and Logistics Management', level: 'bachelor', field: 'Procurement', institution: 'Makerere University Business School', country: 'Uganda', start: '2015-08', end: '2019-05', grade: 'Second Class Upper' },
      ],
      certifications: [{ name: 'CIPS Level 4 Diploma in Procurement and Supply', issuer: 'CIPS', year: '2021' }],
    },
  },
];

/* --------------------------------------------------------- Scholarship seekers (Jobs & Scholarships) */
const scholars: Persona[] = [
  {
    key: 'fatima',
    name: 'Fatima Bello',
    email: 'fatima.bello@example.com',
    plan: 'pro',
    kind: 'scholar',
    profileType: 'academic',
    cvTemplate: 'academic',
    expectTop: 'sch_public_policy',
    expectEligibility: { sch_public_policy: 'eligible', sch_kenya_only: 'not_eligible' },
    profile: {
      current_level: 'bachelor',
      field_of_study: 'Economics',
      qualifications: [
        { qualification: 'BSc Economics', level: 'bachelor', field: 'Economics', institution: 'University of Lagos', country: 'Nigeria', year: '2022', classification: 'First Class Honours', gpa: 4.62, gpa_scale: 5 },
      ],
      research_interests: ['Public finance', 'Social protection', 'Fiscal policy'],
      proposed_research:
        'I want to study how cash-transfer programmes in Nigeria can be targeted with existing administrative data, and what that means for fiscal planning at state level.',
      target_levels: ['master'],
      target_fields: ['Public policy', 'Economics', 'International development'],
      preferred_countries: ['United Kingdom', 'Netherlands'],
      nationality: 'Nigerian',
      residence_country: 'Nigeria',
      languages: [
        { name: 'English', level: 'Fluent', test: 'IELTS', score: '7.5' },
        { name: 'Hausa', level: 'Native' },
      ],
      funding_need: 'full',
      accepts_partial: false,
      awards: [
        { title: "Dean's List, Faculty of Social Sciences", year: '2021' },
        { title: 'Best Graduating Student in Economics', year: '2022' },
      ],
      research_experience:
        'Research assistant at the Lagos Centre for Fiscal Studies (2022–2024): cleaned household survey data and co-wrote two policy briefs on state budgets.',
      work_experience_years: 2,
    },
  },
  {
    key: 'brian',
    name: 'Brian Ochieng',
    email: 'brian.ochieng@example.com',
    plan: 'pro',
    kind: 'scholar',
    profileType: 'academic',
    cvTemplate: 'academic',
    expectTop: 'sch_phd_ai',
    expectEligibility: { sch_phd_ai: 'eligible' },
    profile: {
      current_level: 'master',
      field_of_study: 'Computer Science',
      qualifications: [
        { qualification: 'MSc Computer Science', level: 'master', field: 'Computer Science', institution: 'University of Nairobi', country: 'Kenya', year: '2024', classification: 'Distinction' },
        { qualification: 'BSc Computer Science', level: 'bachelor', field: 'Computer Science', institution: 'Jomo Kenyatta University of Agriculture and Technology', country: 'Kenya', year: '2020', classification: 'First Class Honours' },
      ],
      research_interests: ['Machine learning', 'Natural language processing', 'Low-resource languages'],
      proposed_research:
        'Building speech and text models for Swahili and Dholuo with very little labelled data, using transfer learning and community-collected corpora.',
      target_levels: ['phd'],
      target_fields: ['Artificial intelligence', 'Machine learning', 'Computer science'],
      preferred_countries: ['Germany', 'Canada', 'Netherlands'],
      nationality: 'Kenyan',
      residence_country: 'Kenya',
      languages: [
        { name: 'English', level: 'Fluent', test: 'TOEFL iBT', score: '108' },
        { name: 'Swahili', level: 'Native' },
      ],
      funding_need: 'full',
      publications: [
        { title: 'Few-shot named entity recognition for Swahili news text', venue: 'AfricaNLP Workshop', year: '2024' },
        { title: 'A crowd-sourced Dholuo–English parallel corpus', venue: 'LREC-COLING (poster)', year: '2024' },
      ],
      awards: [{ title: 'Google PhD Fellowship nominee (department)', year: '2024' }],
      research_experience: 'MSc thesis on few-shot NER for Swahili; teaching assistant for Machine Learning (2023).',
    },
  },
  {
    key: 'mariam',
    name: 'Mariam Nakamya',
    email: 'mariam.nakamya@example.com',
    plan: 'pro',
    kind: 'scholar',
    profileType: 'academic',
    cvTemplate: 'academic',
    expectTop: 'sch_mph_east_africa',
    expectEligibility: { sch_mph_east_africa: 'eligible' },
    profile: {
      current_level: 'bachelor',
      field_of_study: 'Nursing',
      qualifications: [
        { qualification: 'Bachelor of Science in Nursing', level: 'bachelor', field: 'Nursing', institution: 'Makerere University', country: 'Uganda', year: '2021', classification: 'Second Class Upper', gpa: 4.1, gpa_scale: 5 },
      ],
      research_interests: ['Maternal health', 'Community health workers', 'Health systems'],
      proposed_research:
        'How community health workers can reduce delays in reaching emergency obstetric care in rural districts of eastern Uganda.',
      target_levels: ['master'],
      target_fields: ['Public health', 'Global health'],
      preferred_countries: ['Kenya', 'United Kingdom', 'South Africa'],
      nationality: 'Ugandan',
      residence_country: 'Uganda',
      languages: [
        { name: 'English', level: 'Fluent' },
        { name: 'Luganda', level: 'Native' },
      ],
      funding_need: 'full',
      awards: [{ title: 'Uganda Nurses and Midwives Council Young Nurse Award', year: '2023' }],
      research_experience: 'Data collector for a district maternal-death review (2023).',
      work_experience_years: 4,
    },
  },
  {
    key: 'tendai',
    name: 'Tendai Moyo',
    email: 'tendai.moyo@example.com',
    plan: 'pro',
    kind: 'scholar',
    profileType: 'academic',
    cvTemplate: 'academic',
    expectTop: 'sch_agri_econ',
    expectEligibility: { sch_agri_econ: 'eligible' },
    profile: {
      current_level: 'bachelor',
      field_of_study: 'Agriculture',
      qualifications: [
        { qualification: 'BSc Agriculture', level: 'bachelor', field: 'Agricultural Economics', institution: 'University of Zimbabwe', country: 'Zimbabwe', year: '2023', classification: 'Upper Second Class' },
      ],
      research_interests: ['Smallholder markets', 'Climate-smart agriculture', 'Agricultural finance'],
      proposed_research: 'Whether index-based crop insurance changes what smallholder maize farmers plant in drought-prone districts.',
      target_levels: ['master'],
      target_fields: ['Agricultural economics', 'Agriculture'],
      preferred_countries: ['South Africa', 'Netherlands'],
      nationality: 'Zimbabwean',
      residence_country: 'Zimbabwe',
      languages: [
        { name: 'English', level: 'Fluent' },
        { name: 'Shona', level: 'Native' },
      ],
      funding_need: 'any',
      accepts_partial: true,
      research_experience: 'Field enumerator for a 600-household farm survey in Masvingo (2023).',
    },
  },
  {
    key: 'sofia',
    name: 'Sofia Haddad',
    email: 'sofia.haddad@example.com',
    plan: 'pro',
    kind: 'scholar',
    profileType: 'academic',
    cvTemplate: 'academic',
    expectTop: 'sch_climate_phd',
    // "Developing countries" cannot be resolved reliably, so she must confirm rather than be rejected.
    expectEligibility: { sch_climate_phd: 'potential', sch_public_policy: 'not_eligible' },
    profile: {
      current_level: 'master',
      field_of_study: 'Environmental Science',
      qualifications: [
        { qualification: 'MSc Environmental Science', level: 'master', field: 'Environmental Science', institution: 'University of Jordan', country: 'Jordan', year: '2024', classification: 'Very Good' },
        { qualification: 'BSc Geology', level: 'bachelor', field: 'Geology', institution: 'Yarmouk University', country: 'Jordan', year: '2020', classification: 'Very Good' },
      ],
      research_interests: ['Climate science', 'Drought', 'Water resources', 'Remote sensing'],
      proposed_research: 'Using satellite soil-moisture records to forecast agricultural drought in the eastern Mediterranean.',
      target_levels: ['phd'],
      target_fields: ['Climate science', 'Environmental science'],
      preferred_countries: ['Sweden', 'Germany', 'Netherlands'],
      nationality: 'Jordanian',
      residence_country: 'Jordan',
      languages: [
        { name: 'Arabic', level: 'Native' },
        { name: 'English', level: 'Fluent', test: 'IELTS', score: '7.0' },
      ],
      funding_need: 'full',
      publications: [{ title: 'Trends in groundwater depletion in the Azraq basin, 2002–2022', venue: 'Jordan Journal of Earth and Environmental Sciences', year: '2024' }],
    },
  },
];

/* --------------------------------------------------------------------- Companies (Complete plan) */
const companies: Persona[] = [
  {
    key: 'kijani',
    name: 'Ruth Achieng (Kijani Build Ltd)',
    email: 'tenders@kijani-build.example.com',
    plan: 'elite',
    kind: 'company',
    profileType: 'business',
    expectTop: 'tnd_roads_works',
    // Their UGX 1B–5B turnover band spans the UGX 1.5B minimum, so the honest answer is "confirm".
    expectEligibility: { tnd_roads_works: 'potential' },
    profile: {
      registered_name: 'Kijani Build Ltd',
      is_registered: true,
      registration_country: 'Uganda',
      registration_number: '80020001234567',
      operating_locations: ['Uganda', 'Kenya'],
      description: 'Civil works contractor delivering urban roads, drainage and public buildings for municipal and donor-funded clients.',
      service_lines: ['Road construction', 'Drainage works', 'Building construction'],
      industries: ['Construction', 'Infrastructure'],
      procurement_categories: ['works'],
      year_established: 2012,
      past_contracts: [
        { title: 'Upgrading of 6 km of municipal roads', client: 'Jinja City Council', year: '2024', value_band: 'UGX 4B' },
        { title: 'Storm-water drainage, Phase 1', client: 'Mbale Municipality', year: '2023', value_band: 'UGX 2.1B' },
        { title: 'Construction of a district health centre', client: 'Ministry of Health', year: '2021', value_band: 'UGX 1.6B' },
      ],
      turnover_band: '1b_5b',
      staff_count: 85,
      certifications: ['ISO 9001:2015'],
      tax_compliance: 'valid',
      ppda_registered: true,
      preferred_geographies: ['Uganda', 'East Africa'],
    },
  },
  {
    key: 'databridge',
    name: 'Peter Kamau (DataBridge Analytics Ltd)',
    email: 'bids@databridge.example.com',
    plan: 'elite',
    kind: 'company',
    profileType: 'business',
    expectTop: 'tnd_hmis_consultancy',
    expectEligibility: { tnd_hmis_consultancy: 'eligible' },
    profile: {
      registered_name: 'DataBridge Analytics Ltd',
      is_registered: true,
      registration_country: 'Kenya',
      operating_locations: ['Kenya', 'Uganda', 'Tanzania'],
      description: 'Health information systems and M&E consultancy: DHIS2 implementation, data systems and evaluations for ministries and NGOs.',
      service_lines: ['Health information systems', 'DHIS2 implementation', 'Monitoring and evaluation', 'Software development'],
      industries: ['Health', 'Information technology'],
      procurement_categories: ['consultancy', 'services'],
      year_established: 2017,
      past_contracts: [
        { title: 'DHIS2 roll-out for county health facilities', client: 'Nakuru County', year: '2024' },
        { title: 'Mid-term evaluation of a nutrition programme', client: 'An international NGO', year: '2023' },
      ],
      turnover_band: '200m_1b',
      staff_count: 22,
      tax_compliance: 'valid',
      preferred_geographies: ['East Africa'],
    },
  },
  {
    key: 'sahel',
    name: 'Aline Uwase (Sahel Medical Supplies Ltd)',
    email: 'sales@sahel-medical.example.com',
    plan: 'elite',
    kind: 'company',
    profileType: 'business',
    expectTop: 'tnd_lab_equipment',
    expectEligibility: { tnd_lab_equipment: 'eligible' },
    profile: {
      registered_name: 'Sahel Medical Supplies Ltd',
      is_registered: true,
      registration_country: 'Rwanda',
      operating_locations: ['Rwanda', 'Burundi', 'Uganda'],
      description: 'Supplier of laboratory equipment, reagents and medical devices to hospitals, with installation and maintenance.',
      service_lines: ['Laboratory equipment supply', 'Medical equipment', 'Laboratory reagents', 'Equipment maintenance'],
      industries: ['Health', 'Medical supplies'],
      procurement_categories: ['goods', 'services'],
      year_established: 2010,
      past_contracts: [{ title: 'Supply of haematology analysers', client: 'A referral hospital', year: '2024' }],
      turnover_band: '1b_5b',
      staff_count: 40,
      certifications: ['ISO 13485'],
      tax_compliance: 'valid',
      preferred_geographies: ['Rwanda', 'East Africa'],
    },
  },
  {
    key: 'brightprint',
    name: 'Moses Ssali (BrightPrint Ltd)',
    email: 'hello@brightprint.example.com',
    plan: 'elite',
    kind: 'company',
    profileType: 'business',
    expectMostRelevant: 'tnd_exam_printing',
    // Highly relevant, but the stated turnover rules a small printer out: relevance and eligibility differ.
    expectEligibility: { tnd_exam_printing: 'not_eligible' },
    profile: {
      registered_name: 'BrightPrint Ltd',
      is_registered: true,
      registration_country: 'Uganda',
      operating_locations: ['Uganda'],
      description: 'Commercial printing, stationery supply and branding for schools and small businesses.',
      service_lines: ['Printing', 'Stationery supply', 'Branding'],
      industries: ['Printing'],
      procurement_categories: ['goods'],
      year_established: 2021,
      turnover_band: 'lt_50m',
      staff_count: 9,
      tax_compliance: 'unknown',
      ppda_registered: false,
    },
  },
  {
    key: 'horizon',
    name: 'Neema Mushi (Horizon Engineering Consultants)',
    email: 'proposals@horizon-eng.example.com',
    plan: 'elite',
    kind: 'company',
    profileType: 'business',
    expectTop: 'tnd_water_supervision',
    expectEligibility: { tnd_water_supervision: 'eligible' },
    profile: {
      registered_name: 'Horizon Engineering Consultants Ltd',
      is_registered: true,
      registration_country: 'Tanzania',
      operating_locations: ['Tanzania', 'Kenya', 'Uganda'],
      description: 'Engineering consultancy for water supply, sanitation and roads: feasibility, design review and construction supervision.',
      service_lines: ['Construction supervision', 'Design review', 'Water supply engineering', 'Feasibility studies'],
      industries: ['Water and sanitation', 'Engineering'],
      procurement_categories: ['consultancy'],
      year_established: 2008,
      past_contracts: [
        { title: 'Supervision of Mwanza peri-urban water supply', client: 'A water authority', year: '2023' },
        { title: 'Design review of 4 rural water schemes', client: 'A development bank project', year: '2022' },
        { title: 'Feasibility study for a sanitation programme', client: 'A city council', year: '2020' },
      ],
      turnover_band: '200m_1b',
      staff_count: 35,
      tax_compliance: 'valid',
      preferred_geographies: ['Tanzania', 'East Africa'],
    },
  },
];

export const PERSONAS: Persona[] = [...professionals, ...scholars, ...companies];

/* --------------------------------------------------------------------------------- Opportunities */
export type FixtureOpportunity = {
  key: string;
  source_id: string;
  input: Record<string, unknown>;
};

const deadline = '2027-03-31T17:00:00.000Z';
const opp = (key: string, source_id: string, input: Record<string, unknown>): FixtureOpportunity => ({
  key,
  source_id,
  input: {
    source_id,
    source_url: `https://example.org/fixtures/${key}`,
    application_url: `https://example.org/fixtures/${key}/apply`,
    deadline_at: deadline,
    verification: 'admin_verified',
    ...input,
  },
});

export const FIXTURE_OPPORTUNITIES: FixtureOpportunity[] = [
  // Jobs
  opp('job_data_analyst', 'src_curated_jobs', {
    category: 'job', title: 'Senior Data Analyst', organization: 'Pan-African Payments Group',
    description: 'We are hiring a Senior Data Analyst to own revenue and customer analytics. You will build SQL models, Python analyses and Power BI dashboards, and work with finance and product leads.',
    country: 'Nigeria', location: 'Lagos', remote: 'hybrid',
    requirements: { skills: ['SQL', 'Python', 'Power BI', 'Statistics'], min_experience_years: 5, education_level: 'bachelor', employment_type: 'full time' },
  }),
  opp('job_resident_engineer', 'src_curated_jobs', {
    category: 'job', title: 'Resident Engineer – Urban Roads', organization: 'Lakeside Infrastructure Partners',
    description: 'Resident Engineer to supervise urban road and drainage works: contract supervision, design review in AutoCAD and Civil 3D, quality control and monthly valuations. Open to Kenyan citizens registered with the EBK.',
    country: 'Kenya', location: 'Nairobi', remote: 'onsite',
    requirements: { skills: ['AutoCAD', 'Road design', 'Contract supervision', 'Drainage design'], min_experience_years: 7, education_level: 'bachelor', eligible_countries: ['Kenya'] },
  }),
  opp('job_me_specialist', 'src_curated_jobs', {
    category: 'job', title: 'Monitoring and Evaluation Specialist (Public Health)', organization: 'Global Health Alliance',
    description: 'Lead monitoring and evaluation for a multi-district public health programme: DHIS2 reporting, data quality assessment, epidemiology support and learning reviews.',
    country: 'Uganda', location: 'Kampala', remote: 'onsite',
    requirements: { skills: ['Monitoring and evaluation', 'DHIS2', 'Epidemiology', 'Data quality assessment'], min_experience_years: 7, education_level: 'master', languages: ['English'] },
  }),
  opp('job_frontend', 'src_curated_jobs', {
    category: 'job', title: 'Senior Frontend Engineer (Remote)', organization: 'Northwind Software',
    description: 'Fully remote role building our customer dashboard in React and TypeScript, with Node.js services on AWS. Open to candidates in Latin America and Europe.',
    country: '', location: 'Remote', remote: 'remote',
    requirements: { skills: ['TypeScript', 'React', 'Node.js', 'AWS'], min_experience_years: 5, eligible_countries: ['Latin America', 'Europe'] },
  }),
  opp('job_procurement', 'src_curated_jobs', {
    category: 'job', title: 'Procurement Officer', organization: 'Great Lakes Water Utility',
    description: 'Procurement Officer to plan and run procurements under the PPDA Act and donor rules, manage contracts and evaluate suppliers. CIPS qualification is an advantage.',
    country: 'Uganda', location: 'Kampala', remote: 'onsite',
    requirements: { skills: ['Procurement', 'Contract management', 'PPDA regulations', 'Supplier evaluation'], min_experience_years: 3, education_level: 'bachelor', eligible_countries: ['East Africa'] },
  }),
  opp('job_programme_data_officer', 'src_curated_jobs', {
    category: 'job', title: 'Programme Data Officer', organization: 'Commonwealth Development Network',
    description: 'Programme data officer supporting monitoring and evaluation, survey design and Stata analysis across member-country programmes. Open to nationals of Commonwealth countries.',
    country: 'United Kingdom', location: 'London', remote: 'hybrid',
    requirements: { skills: ['Monitoring and evaluation', 'Stata', 'Survey design'], min_experience_years: 3, eligible_countries: ['Commonwealth'] },
  }),
  opp('job_head_chef', 'src_curated_jobs', {
    category: 'job', title: 'Head Chef', organization: 'Coral Bay Resort',
    description: 'Head Chef for a 120-room beach resort: menu planning, food safety, kitchen team leadership and supplier management.',
    country: 'Kenya', location: 'Mombasa', remote: 'onsite',
    requirements: { skills: ['Menu planning', 'Food safety', 'Kitchen management'], min_experience_years: 5 },
  }),
  // Scholarships
  opp('sch_public_policy', 'src_curated_scholarships', {
    category: 'scholarship', title: "Fully Funded Master's Scholarship in Public Policy", organization: 'Westbridge University',
    description: "One-year master's in public policy, economics or international development. Covers tuition, a living stipend and flights. Open to citizens of Commonwealth countries.",
    country: 'United Kingdom', location: 'London',
    requirements: { degree_levels: ['master'], fields: ['Public policy', 'Economics', 'International development'], eligible_countries: ['Commonwealth'], funding: 'full', languages: ['English'] },
  }),
  opp('sch_phd_ai', 'src_curated_scholarships', {
    category: 'scholarship', title: 'Fully Funded PhD Positions in Artificial Intelligence', organization: 'Rhine Institute of Technology',
    description: 'Four-year funded PhD positions in machine learning, natural language processing and artificial intelligence. Applicants need a master’s in computer science or a related field. Open worldwide.',
    country: 'Germany', location: 'Aachen',
    requirements: { degree_levels: ['phd'], fields: ['Artificial intelligence', 'Machine learning', 'Computer science'], eligible_countries: ['International'], funding: 'full', education_level: 'master' },
  }),
  opp('sch_mph_east_africa', 'src_curated_scholarships', {
    category: 'scholarship', title: 'Master of Public Health Scholarships for East African Health Workers', organization: 'Lakes Health Foundation',
    description: 'Full scholarships for nurses, midwives and clinicians from East Africa to study a Master of Public Health, with a focus on maternal and community health.',
    country: 'Kenya', location: 'Nairobi',
    requirements: { degree_levels: ['master'], fields: ['Public health', 'Global health', 'Nursing'], eligible_countries: ['East Africa'], funding: 'full' },
  }),
  opp('sch_agri_econ', 'src_curated_scholarships', {
    category: 'scholarship', title: 'MSc Agricultural Economics Scholarships (SADC)', organization: 'Cape Agricultural University',
    description: 'Partial scholarships covering tuition for an MSc in Agricultural Economics. Open to citizens of SADC member states.',
    country: 'South Africa', location: 'Stellenbosch',
    requirements: { degree_levels: ['master'], fields: ['Agricultural economics', 'Agriculture'], eligible_countries: ['SADC'], funding: 'partial' },
  }),
  opp('sch_climate_phd', 'src_curated_scholarships', {
    category: 'scholarship', title: 'Doctoral Scholarships in Climate and Environmental Science', organization: 'Nordic Climate Research Centre',
    description: 'Funded PhD places in climate science, hydrology and environmental science for applicants from developing countries.',
    country: 'Sweden', location: 'Uppsala',
    requirements: { degree_levels: ['phd'], fields: ['Climate science', 'Environmental science'], eligible_countries: ['Developing countries'], funding: 'full', education_level: 'master' },
  }),
  opp('sch_kenya_only', 'src_curated_scholarships', {
    category: 'scholarship', title: 'Graduate Scholarship for Kenyan Citizens', organization: 'Savannah Education Trust',
    description: "Master's scholarships in economics, engineering and computer science for Kenyan citizens.",
    country: 'Kenya', location: 'Nairobi',
    requirements: { degree_levels: ['master'], fields: ['Economics', 'Engineering', 'Computer science'], eligible_countries: ['Kenya'], funding: 'full' },
  }),
  // Tenders and contracts
  opp('tnd_roads_works', 'src_curated_procurement_ug', {
    category: 'tender', title: 'Rehabilitation of Urban Roads and Drainage, Lot 2', organization: 'Northern Region Municipal Council',
    description: 'Invitation to bid for road construction and drainage works: 4.8 km of urban roads, culverts and lined drains. Bidders must be registered, hold a valid tax clearance and show average annual turnover of at least UGX 1.5 billion.',
    country: 'Uganda', location: 'Gulu',
    requirements: { applicant_type: 'business', procurement_categories: ['works'], registration_required: true, tax_clearance_required: true, min_turnover_ugx: 1_500_000_000, min_years_in_operation: 5, eligible_countries: ['East Africa'] },
  }),
  opp('tnd_hmis_consultancy', 'src_curated_procurement_ug', {
    category: 'rfp', title: 'Consultancy to Upgrade a County Health Information System (DHIS2)', organization: 'Western County Health Department',
    description: 'Request for proposals from firms to upgrade the county health information system on DHIS2, train facility staff and set up monitoring and evaluation dashboards.',
    country: 'Kenya', location: 'Kisumu',
    requirements: { applicant_type: 'business', procurement_categories: ['consultancy'], registration_required: true, eligible_countries: ['Kenya', 'Uganda', 'Tanzania'] },
  }),
  opp('tnd_lab_equipment', 'src_curated_procurement_ug', {
    category: 'rfq', title: 'Supply, Installation and Maintenance of Laboratory Equipment', organization: 'Kigali Teaching Hospital',
    description: 'Request for quotations for the supply, installation and maintenance of laboratory equipment and reagents, including haematology and chemistry analysers.',
    country: 'Rwanda', location: 'Kigali',
    requirements: { applicant_type: 'business', procurement_categories: ['goods'], registration_required: true, tax_clearance_required: true, min_turnover_ugx: 500_000_000 },
  }),
  opp('tnd_exam_printing', 'src_curated_procurement_ug', {
    category: 'tender', title: 'Printing and Delivery of National Examination Papers', organization: 'Central Examinations Board',
    description: 'Secure printing, packing and delivery of examination papers and stationery. Bidders must show average annual turnover of at least UGX 300 million and hold a valid tax clearance.',
    country: 'Uganda', location: 'Kampala',
    requirements: { applicant_type: 'business', procurement_categories: ['goods'], registration_required: true, tax_clearance_required: true, min_turnover_ugx: 300_000_000 },
  }),
  opp('tnd_water_supervision', 'src_curated_procurement_ug', {
    category: 'eoi', title: 'Design Review and Construction Supervision of Water Supply Schemes', organization: 'Lake Zone Water Authority',
    description: 'Expression of interest from consulting firms for feasibility review, design review and construction supervision of six water supply schemes. Firms need at least ten years in operation.',
    country: 'Tanzania', location: 'Mwanza',
    requirements: { applicant_type: 'business', procurement_categories: ['consultancy'], registration_required: true, min_years_in_operation: 10, eligible_countries: ['East Africa'] },
  }),
]; // prettier-ignore
