/**
 * Suggestions for profile forms: built-in vocabularies for type-ahead, and rules that read what a person has
 * entered so far and propose what usually goes with it ("Civil Engineer" → AutoCAD, Road design, …).
 * Suggestions are only offered; nothing is added to a profile unless the person clicks it.
 */
import { canonicalCountry, worldCountryNames } from './countries';

type Family = {
  /** Lower-case fragments that identify the family in titles, headlines, skills or industries. */
  keys: string[];
  titles: string[];
  skills: string[];
  industries: string[];
  certifications?: string[];
};

const FAMILIES: Family[] = [
  {
    keys: ['data', 'analyst', 'analytics', 'statistic', 'business intelligence'],
    titles: ['Data Analyst', 'Senior Data Analyst', 'Data Scientist', 'Business Intelligence Analyst', 'Statistician', 'Data Engineer'],
    skills: ['SQL', 'Python', 'Excel', 'Power BI', 'Tableau', 'Statistics', 'Data visualisation', 'Data cleaning', 'R', 'Machine learning', 'dbt'],
    industries: ['Technology', 'Financial services', 'NGO / development', 'Consulting'],
    certifications: ['Microsoft Certified: Power BI Data Analyst Associate', 'Google Data Analytics Certificate'],
  },
  {
    keys: ['software', 'developer', 'frontend', 'front-end', 'backend', 'back-end', 'full stack', 'full-stack', 'programmer', 'web', 'mobile app', 'devops'],
    titles: ['Software Engineer', 'Frontend Developer', 'Backend Developer', 'Full-stack Developer', 'Mobile Developer', 'DevOps Engineer'],
    skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'SQL', 'Git', 'REST APIs', 'AWS', 'Docker', 'Automated testing', 'Java'],
    industries: ['Technology', 'Fintech', 'E-commerce', 'Telecommunications'],
    certifications: ['AWS Certified Developer – Associate', 'Microsoft Certified: Azure Developer Associate'],
  },
  {
    keys: ['ict', 'it officer', 'it support', 'network', 'systems admin', 'cyber', 'helpdesk'],
    titles: ['IT Officer', 'IT Support Specialist', 'Systems Administrator', 'Network Engineer', 'Cybersecurity Analyst'],
    skills: ['Networking', 'Windows Server', 'Linux', 'Active Directory', 'Troubleshooting', 'Cybersecurity', 'Microsoft 365 administration', 'Backup and recovery'],
    industries: ['Technology', 'Telecommunications', 'Public sector'],
    certifications: ['CompTIA A+', 'CompTIA Security+', 'Cisco CCNA'],
  },
  {
    keys: ['civil', 'structural', 'road', 'highway', 'construction', 'site engineer', 'quantity surveyor', 'resident engineer'],
    titles: ['Civil Engineer', 'Site Engineer', 'Resident Engineer', 'Structural Engineer', 'Quantity Surveyor', 'Construction Manager'],
    skills: ['AutoCAD', 'Civil 3D', 'Road design', 'Drainage design', 'Structural analysis', 'Contract supervision', 'Site supervision', 'Bills of quantities', 'Quality control', 'Project management'],
    industries: ['Construction', 'Infrastructure', 'Engineering consultancy'],
    certifications: ['Registered Engineer', 'PMP'],
  },
  {
    keys: ['electrical', 'mechanical', 'energy', 'solar', 'power engineer', 'power systems', 'hvac'],
    titles: ['Electrical Engineer', 'Mechanical Engineer', 'Energy Engineer', 'Solar PV Technician', 'Maintenance Engineer'],
    skills: ['Electrical installation', 'Solar PV design', 'Power systems', 'Preventive maintenance', 'AutoCAD', 'HVAC', 'Health and safety'],
    industries: ['Energy', 'Manufacturing', 'Construction'],
    certifications: ['Registered Engineer'],
  },
  {
    keys: ['m&e', 'monitoring', 'evaluation', 'meal', 'public health', 'epidemiolog'],
    titles: ['M&E Officer', 'M&E Specialist', 'MEAL Coordinator', 'Public Health Specialist', 'Epidemiologist'],
    skills: ['Monitoring and evaluation', 'DHIS2', 'Data quality assessment', 'Survey design', 'KoboToolbox', 'Stata', 'SPSS', 'Logframes', 'Epidemiology', 'Report writing'],
    industries: ['Global health', 'NGO / development', 'Public sector'],
  },
  {
    keys: ['nurse', 'nursing', 'midwi', 'clinical', 'medical officer', 'doctor', 'physician', 'pharmac', 'laboratory', 'lab tech'],
    titles: ['Registered Nurse', 'Midwife', 'Clinical Officer', 'Medical Officer', 'Pharmacist', 'Laboratory Technologist'],
    skills: ['Patient care', 'Clinical assessment', 'Infection prevention and control', 'Maternal and child health', 'Health education', 'Electronic medical records', 'Basic life support'],
    industries: ['Health care', 'Global health', 'NGO / development'],
    certifications: ['Basic Life Support (BLS)', 'Advanced Cardiac Life Support (ACLS)'],
  },
  {
    keys: ['procurement', 'supply chain', 'logistic', 'purchas', 'stores', 'warehouse'],
    titles: ['Procurement Officer', 'Procurement Specialist', 'Supply Chain Officer', 'Logistics Officer', 'Stores Officer'],
    skills: ['Procurement', 'Contract management', 'Supplier evaluation', 'Bid evaluation', 'Negotiation', 'Inventory management', 'Logistics', 'Public procurement regulations', 'Excel'],
    industries: ['Public sector', 'NGO / development', 'Manufacturing', 'Utilities'],
    certifications: ['CIPS Level 4 Diploma in Procurement and Supply', 'CIPS Level 6 Professional Diploma'],
  },
  {
    keys: ['account', 'finance', 'financial', 'audit', 'tax', 'bookkeep', 'treasury'],
    titles: ['Accountant', 'Finance Officer', 'Financial Analyst', 'Internal Auditor', 'Tax Consultant', 'Finance Manager'],
    skills: ['Financial reporting', 'IFRS', 'Budgeting', 'Reconciliations', 'Audit', 'Tax compliance', 'Financial analysis', 'QuickBooks', 'Excel'],
    industries: ['Financial services', 'Banking', 'Consulting', 'NGO / development'],
    certifications: ['ACCA', 'CPA', 'CFA'],
  },
  {
    keys: ['human resource', 'hr ', 'recruit', 'talent', 'people partner', 'payroll'],
    titles: ['HR Officer', 'HR Manager', 'Recruitment Specialist', 'Talent Acquisition Partner', 'Payroll Officer'],
    skills: ['Recruitment', 'Employee relations', 'Performance management', 'Payroll', 'Labour law', 'HRIS', 'Onboarding', 'Training and development'],
    industries: ['Consulting', 'NGO / development', 'Financial services'],
    certifications: ['CIPD Level 5', 'SHRM-CP'],
  },
  {
    keys: ['marketing', 'communication', 'brand', 'digital', 'content', 'social media', 'public relations', 'copywrit'],
    titles: ['Marketing Officer', 'Digital Marketing Specialist', 'Communications Officer', 'Content Writer', 'Brand Manager'],
    skills: ['Digital marketing', 'Social media management', 'Content writing', 'Copywriting', 'SEO', 'Google Analytics', 'Public relations', 'Campaign management', 'Graphic design'],
    industries: ['Media and advertising', 'Technology', 'NGO / development', 'Retail'],
    certifications: ['Google Ads Certification', 'HubSpot Content Marketing'],
  },
  {
    keys: ['sales', 'business development', 'account manager', 'customer service', 'relationship manager'],
    titles: ['Sales Executive', 'Business Development Manager', 'Account Manager', 'Relationship Manager', 'Customer Service Officer'],
    skills: ['Sales', 'Business development', 'Negotiation', 'Customer service', 'CRM', 'Lead generation', 'Key account management', 'Presentation skills'],
    industries: ['Financial services', 'Retail', 'Telecommunications', 'Manufacturing'],
  },
  {
    keys: ['project', 'programme', 'program', 'coordinator', 'grants'],
    titles: ['Project Manager', 'Programme Manager', 'Project Coordinator', 'Programme Officer', 'Grants Manager'],
    skills: ['Project management', 'Budget management', 'Stakeholder engagement', 'Donor reporting', 'Risk management', 'Work planning', 'Team leadership', 'Grant management'],
    industries: ['NGO / development', 'Consulting', 'Public sector'],
    certifications: ['PMP', 'PRINCE2 Practitioner'],
  },
  {
    keys: ['teach', 'lecturer', 'tutor', 'education', 'trainer', 'curriculum'],
    titles: ['Teacher', 'Lecturer', 'Trainer', 'Education Officer', 'Curriculum Developer'],
    skills: ['Lesson planning', 'Curriculum development', 'Classroom management', 'Assessment', 'E-learning', 'Mentoring', 'Training delivery'],
    industries: ['Education', 'NGO / development'],
  },
  {
    keys: ['agri', 'agronom', 'farm', 'livestock', 'extension', 'value chain'],
    titles: ['Agronomist', 'Agricultural Officer', 'Extension Officer', 'Value Chain Specialist', 'Livestock Officer'],
    skills: ['Agronomy', 'Crop production', 'Extension services', 'Value chain analysis', 'Climate-smart agriculture', 'Farmer training', 'Soil science'],
    industries: ['Agriculture', 'NGO / development', 'Food processing'],
  },
  {
    keys: ['legal', 'lawyer', 'advocate', 'counsel', 'compliance', 'paralegal'],
    titles: ['Legal Officer', 'Advocate', 'Legal Counsel', 'Compliance Officer', 'Paralegal'],
    skills: ['Legal drafting', 'Contract review', 'Legal research', 'Litigation', 'Regulatory compliance', 'Corporate law'],
    industries: ['Legal services', 'Financial services', 'Public sector'],
  },
  {
    keys: ['admin', 'assistant', 'secretary', 'office manager', 'receptionist'],
    titles: ['Administrative Assistant', 'Office Manager', 'Executive Assistant', 'Receptionist', 'Administrative Officer'],
    skills: ['Office administration', 'Scheduling', 'Record keeping', 'Microsoft Office', 'Correspondence', 'Customer service', 'Minute taking'],
    industries: ['NGO / development', 'Public sector', 'Consulting'],
  },
  {
    keys: ['graphic design', 'designer', 'ux', 'creative', 'illustrat'],
    titles: ['Graphic Designer', 'UX Designer', 'UI Designer', 'Product Designer', 'Creative Director'],
    skills: ['Figma', 'Adobe Photoshop', 'Adobe Illustrator', 'UX research', 'Prototyping', 'Typography', 'Branding'],
    industries: ['Media and advertising', 'Technology'],
  },
  {
    keys: ['chef', 'cook', 'hotel', 'hospitality', 'restaurant', 'catering'],
    titles: ['Chef', 'Head Chef', 'Hotel Manager', 'Front Office Manager', 'Catering Manager'],
    skills: ['Menu planning', 'Food safety', 'Kitchen management', 'Customer service', 'Inventory management', 'Team leadership'],
    industries: ['Hospitality', 'Tourism'],
  },
  {
    keys: ['research', 'scientist', 'postdoc', 'fellow'],
    titles: ['Research Assistant', 'Research Officer', 'Research Fellow', 'Research Scientist'],
    skills: ['Literature review', 'Qualitative research', 'Quantitative research', 'Data analysis', 'Academic writing', 'NVivo', 'R'],
    industries: ['Research', 'Education', 'NGO / development'],
  },
  {
    keys: ['water', 'wash', 'sanitation', 'environment', 'hydrolog', 'climate'],
    titles: ['WASH Officer', 'Water Engineer', 'Environmental Officer', 'Environmental Specialist', 'Climate Change Specialist'],
    skills: ['Water supply design', 'Sanitation', 'Hygiene promotion', 'Environmental impact assessment', 'GIS', 'Hydrology', 'Climate risk assessment'],
    industries: ['Water and sanitation', 'Environment', 'NGO / development'],
  },
]; // prettier-ignore

const GENERIC_SKILLS = ['Communication', 'Teamwork', 'Problem solving', 'Microsoft Office', 'Report writing', 'Time management', 'Leadership', 'Customer service']; // prettier-ignore

export const INDUSTRIES = [
  'Agriculture', 'Banking', 'Construction', 'Consulting', 'E-commerce', 'Education', 'Energy', 'Engineering consultancy',
  'Environment', 'Financial services', 'Fintech', 'Food processing', 'Global health', 'Health care', 'Hospitality',
  'Infrastructure', 'Legal services', 'Manufacturing', 'Media and advertising', 'Mining', 'NGO / development',
  'Public sector', 'Real estate', 'Research', 'Retail', 'Technology', 'Telecommunications', 'Tourism',
  'Transport and logistics', 'Utilities', 'Water and sanitation',
]; // prettier-ignore

export const JOB_TITLES = [...new Set(FAMILIES.flatMap((f) => f.titles))].sort();
export const SKILLS = [...new Set([...FAMILIES.flatMap((f) => f.skills), ...GENERIC_SKILLS])].sort();
export const CERTIFICATIONS = [...new Set(FAMILIES.flatMap((f) => f.certifications ?? []))].sort();

export const LANGUAGES = [
  'English', 'French', 'Arabic', 'Spanish', 'Portuguese', 'German', 'Swahili', 'Amharic', 'Hausa', 'Yoruba', 'Igbo',
  'Zulu', 'Xhosa', 'Shona', 'Somali', 'Luganda', 'Kinyarwanda', 'Lingala', 'Wolof', 'Twi', 'Hindi', 'Urdu', 'Bengali',
  'Mandarin Chinese', 'Japanese', 'Korean', 'Russian', 'Italian', 'Dutch', 'Turkish', 'Persian', 'Indonesian',
  'Malay', 'Tagalog', 'Vietnamese', 'Thai',
]; // prettier-ignore

export const LANGUAGE_TESTS = ['IELTS', 'TOEFL iBT', 'Duolingo English Test', 'Cambridge C1 Advanced', 'PTE Academic', 'DELF', 'DALF', 'TestDaF', 'Goethe-Zertifikat', 'DELE', 'HSK']; // prettier-ignore

/** Country names for type-ahead, in their usual written form. */
export const COUNTRY_NAMES = worldCountryNames();

/* ------------------------------------------------------------------------------------- Academic */
const FIELD_GROUPS: Array<{ keys: string[]; fields: string[]; interests: string[] }> = [
  { keys: ['econom', 'finance', 'public policy', 'development'], fields: ['Economics', 'Public policy', 'Development economics', 'International development', 'Finance', 'Econometrics'], interests: ['Public finance', 'Development economics', 'Poverty and inequality', 'Social protection', 'Trade policy', 'Fiscal policy', 'Labour economics'] },
  { keys: ['computer', 'software', 'artificial intelligence', 'machine learning', 'data science', 'information'], fields: ['Computer science', 'Artificial intelligence', 'Machine learning', 'Data science', 'Information systems', 'Cybersecurity'], interests: ['Machine learning', 'Natural language processing', 'Computer vision', 'Data privacy', 'Distributed systems', 'Human-computer interaction'] },
  { keys: ['public health', 'nursing', 'medicine', 'health', 'epidemiolog', 'pharmac'], fields: ['Public health', 'Global health', 'Epidemiology', 'Nursing', 'Medicine', 'Health policy'], interests: ['Maternal health', 'Infectious diseases', 'Health systems', 'Non-communicable diseases', 'Nutrition', 'Mental health'] },
  { keys: ['agri', 'agronom', 'food', 'soil', 'veterinar'], fields: ['Agriculture', 'Agricultural economics', 'Agronomy', 'Food science', 'Soil science', 'Animal science'], interests: ['Climate-smart agriculture', 'Smallholder markets', 'Food security', 'Crop breeding', 'Agricultural finance'] },
  { keys: ['environment', 'climate', 'geolog', 'hydrolog', 'water', 'earth'], fields: ['Environmental science', 'Climate science', 'Geology', 'Hydrology', 'Natural resource management', 'Geography'], interests: ['Climate change adaptation', 'Water resources', 'Drought', 'Remote sensing', 'Biodiversity', 'Renewable energy'] },
  { keys: ['engineer', 'civil', 'electrical', 'mechanical'], fields: ['Civil engineering', 'Electrical engineering', 'Mechanical engineering', 'Structural engineering', 'Renewable energy engineering'], interests: ['Sustainable infrastructure', 'Transport systems', 'Renewable energy', 'Structural safety', 'Smart grids'] },
  { keys: ['law', 'legal', 'human rights'], fields: ['Law', 'International law', 'Human rights', 'Commercial law'], interests: ['Human rights', 'International trade law', 'Constitutional law', 'Environmental law'] },
  { keys: ['business', 'management', 'mba', 'marketing', 'account'], fields: ['Business administration', 'Management', 'Accounting', 'Marketing', 'Entrepreneurship'], interests: ['Entrepreneurship', 'Corporate governance', 'Digital transformation', 'Supply chain management'] },
  { keys: ['education', 'teaching', 'pedagog'], fields: ['Education', 'Educational leadership', 'Curriculum studies'], interests: ['Teacher training', 'Education technology', 'Early childhood education', 'Inclusive education'] },
  { keys: ['social', 'sociolog', 'anthropolog', 'psycholog', 'political', 'international relations'], fields: ['Sociology', 'Psychology', 'Political science', 'International relations', 'Social work', 'Gender studies'], interests: ['Gender and development', 'Migration', 'Governance', 'Conflict and peacebuilding', 'Youth employment'] },
  { keys: ['math', 'statistic', 'physics', 'chemistry', 'biology'], fields: ['Mathematics', 'Statistics', 'Physics', 'Chemistry', 'Biology', 'Biotechnology'], interests: ['Applied statistics', 'Mathematical modelling', 'Materials science', 'Molecular biology', 'Biostatistics'] },
]; // prettier-ignore

export const FIELDS_OF_STUDY = [...new Set(FIELD_GROUPS.flatMap((g) => g.fields))].sort();
export const RESEARCH_INTERESTS = [...new Set(FIELD_GROUPS.flatMap((g) => g.interests))].sort();

/* ------------------------------------------------------------------------------------- Business */
const SECTORS: Array<{ keys: string[]; sector: string; services: string[]; products?: string[]; certifications?: string[] }> = [
  { keys: ['construct', 'civil works', 'road', 'building', 'contractor'], sector: 'Construction', services: ['Road construction', 'Building construction', 'Drainage works', 'Renovations', 'Water supply works'], certifications: ['ISO 9001', 'ISO 45001'] },
  { keys: ['engineering consult', 'supervision', 'design review', 'feasibility'], sector: 'Engineering consultancy', services: ['Construction supervision', 'Design review', 'Feasibility studies', 'Engineering design', 'Environmental and social impact assessment'], certifications: ['ISO 9001'] },
  { keys: ['software', 'it ', 'ict', 'technology', 'digital', 'data system', 'dhis2'], sector: 'Technology', services: ['Software development', 'IT support', 'Network installation', 'Health information systems', 'Data systems', 'Cybersecurity services'], products: ['Computers and accessories', 'Networking equipment', 'Software licences'], certifications: ['ISO 27001', 'ISO 9001'] },
  { keys: ['medical', 'laborator', 'pharmac', 'health suppl', 'hospital'], sector: 'Medical supplies', services: ['Medical equipment supply', 'Laboratory equipment supply', 'Equipment installation', 'Equipment maintenance'], products: ['Laboratory reagents', 'Medical consumables', 'Diagnostic equipment', 'Pharmaceuticals'], certifications: ['ISO 13485', 'ISO 9001'] },
  { keys: ['print', 'stationer', 'branding'], sector: 'Printing and stationery', services: ['Printing', 'Secure printing', 'Branding', 'Stationery supply'], products: ['Stationery', 'Branded merchandise', 'Office paper'] },
  { keys: ['consult', 'evaluation', 'research', 'survey', 'm&e'], sector: 'Consulting', services: ['Monitoring and evaluation', 'Baseline and endline surveys', 'Research and studies', 'Capacity building', 'Policy analysis'] },
  { keys: ['cater', 'food', 'restaurant'], sector: 'Catering', services: ['Catering services', 'Event catering', 'Food supply'] },
  { keys: ['security', 'guard'], sector: 'Security services', services: ['Manned guarding', 'CCTV installation', 'Alarm response'] },
  { keys: ['clean', 'facilit', 'janitor'], sector: 'Cleaning and facilities', services: ['Cleaning services', 'Facility management', 'Pest control', 'Waste management'] },
  { keys: ['transport', 'logistic', 'freight', 'courier'], sector: 'Transport and logistics', services: ['Freight transport', 'Courier services', 'Vehicle hire', 'Clearing and forwarding'] },
  { keys: ['solar', 'energy', 'electrical', 'power'], sector: 'Energy', services: ['Solar installation', 'Electrical installation', 'Generator maintenance', 'Energy audits'], products: ['Solar panels', 'Batteries and inverters', 'Electrical supplies'] },
  { keys: ['agri', 'farm', 'seed', 'fertili', 'agro'], sector: 'Agriculture', services: ['Agricultural inputs supply', 'Agro-processing', 'Extension services'], products: ['Seeds', 'Fertilisers', 'Farm tools'] },
  { keys: ['furniture', 'office equip'], sector: 'Office furniture and equipment', services: ['Furniture supply', 'Office equipment supply'], products: ['Office furniture', 'School furniture', 'Office equipment'] },
  { keys: ['training provider', 'training services', 'e-learning', 'curriculum'], sector: 'Education and training', services: ['Training delivery', 'Curriculum development', 'E-learning content'] },
  { keys: ['event', 'media', 'advertis', 'video'], sector: 'Media and events', services: ['Event management', 'Video production', 'Advertising', 'Public relations'] },
]; // prettier-ignore

export const BUSINESS_SECTORS = SECTORS.map((s) => s.sector);
export const SERVICE_LINES = [...new Set(SECTORS.flatMap((s) => s.services))].sort();
export const PRODUCTS = [...new Set(SECTORS.flatMap((s) => s.products ?? []))].sort();
export const BUSINESS_CERTIFICATIONS = ['ISO 9001', 'ISO 14001', 'ISO 45001', 'ISO 27001', 'ISO 13485', 'National supplier register', 'Professional body registration']; // prettier-ignore
export const LICENCES = ['Business registration certificate', 'Trading licence', 'Tax registration certificate', 'Import licence', 'Professional practising licence', 'Contractor registration', 'Pharmacy or medical supplies licence']; // prettier-ignore
export const BUYERS = ['Government ministries', 'Local governments', 'UN agencies', 'International NGOs', 'Development banks', 'Embassies', 'Hospitals', 'Universities and schools', 'Private companies']; // prettier-ignore
export const SUPPLIER_CLASSIFICATIONS = ['Women-owned business', 'Youth-owned business', 'Small or medium enterprise', 'Locally owned business', 'Persons with disabilities-owned business']; // prettier-ignore

/* ---------------------------------------------------------------------------------- Rules */
type Data = Record<string, any>;

const lower = (xs: unknown[]) =>
  xs
    .filter((x): x is string => typeof x === 'string' && !!x)
    .join(' | ')
    .toLowerCase();
const fresh = (picked: unknown, list: string[]) => {
  const have = new Set((Array.isArray(picked) ? picked : []).map((x) => String(x).toLowerCase()));
  return [...new Set(list)].filter((x) => !have.has(x.toLowerCase()));
};

/** Families whose keywords appear in the given text, most matches first. */
function familiesIn(text: string): Family[] {
  if (!text) return [];
  return FAMILIES.map((f) => ({ f, hits: f.keys.filter((k) => text.includes(k)).length }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .map((x) => x.f);
}

/**
 * Role families come from what the person does (headline, target roles, past job titles). Skills and
 * industries are only used when no titles exist yet: a skill like "Road design" must not make someone look
 * like a graphic designer.
 */
function careerFamilies(d: Data): Family[] {
  const titles = lower([
    d.headline,
    ...(d.target_titles ?? []),
    ...(d.experience ?? []).map((e: any) => e?.title),
  ]);
  const fromTitles = familiesIn(titles);
  return fromTitles.length ? fromTitles : familiesIn(lower([...(d.industries ?? []), ...(d.skills ?? [])]));
}

export const suggestCareer = {
  targetTitles: (d: Data) =>
    fresh(d.target_titles, [
      ...(d.headline ? [d.headline] : []),
      ...(d.experience ?? []).map((e: any) => e?.title).filter(Boolean),
      ...careerFamilies(d).flatMap((f) => f.titles),
    ]),
  skills: (d: Data) => {
    const fams = careerFamilies(d);
    return fresh(d.skills, fams.length ? fams.flatMap((f) => f.skills) : GENERIC_SKILLS);
  },
  industries: (d: Data) =>
    fresh(
      d.industries,
      careerFamilies(d).flatMap((f) => f.industries),
    ),
  headline: (d: Data) =>
    [...new Set([...(d.target_titles ?? []), ...careerFamilies(d).flatMap((f) => f.titles)])].slice(0, 6),
  certifications: (d: Data) =>
    fresh(
      (d.certifications ?? []).map((c: any) => c?.name),
      careerFamilies(d).flatMap((f) => f.certifications ?? []),
    ),
  preferredCountries: (d: Data) =>
    fresh(d.preferred_countries, [d.country, d.nationality].filter(Boolean).map(displayCountry)),
};

const academicText = (d: Data) =>
  lower([
    d.field_of_study,
    ...(d.target_fields ?? []),
    ...(d.qualifications ?? []).map((q: any) => q?.field),
    ...(d.qualifications ?? []).map((q: any) => q?.qualification),
    ...(d.research_interests ?? []),
  ]);
const groupsIn = (text: string) => FIELD_GROUPS.filter((g) => g.keys.some((k) => text.includes(k)));
const LEVEL_PREFIX: Record<string, string> = {
  bachelor: "Bachelor's in",
  master: "Master's in",
  phd: 'PhD in',
  postdoc: 'Postdoctoral fellowship in',
  short_course: 'Short course in',
  exchange: 'Exchange programme in',
};

export const suggestAcademic = {
  targetFields: (d: Data) =>
    fresh(
      d.target_fields,
      [d.field_of_study, ...groupsIn(academicText(d)).flatMap((g) => g.fields)].filter(Boolean),
    ),
  researchInterests: (d: Data) =>
    fresh(
      d.research_interests,
      groupsIn(academicText(d)).flatMap((g) => g.interests),
    ),
  targetProgrammes: (d: Data) => {
    const fields = [...(d.target_fields ?? []), d.field_of_study].filter(Boolean).slice(0, 3);
    const levels = (d.target_levels ?? []).filter((l: string) => LEVEL_PREFIX[l]);
    return fresh(
      d.target_programmes,
      levels.flatMap((l: string) => fields.map((f: string) => `${LEVEL_PREFIX[l]} ${f}`)),
    );
  },
  fieldOfStudy: (d: Data) =>
    [...new Set([...(d.qualifications ?? []).map((q: any) => q?.field).filter(Boolean)])].slice(0, 4),
  preferredCountries: (d: Data) =>
    fresh(d.preferred_countries, ['United Kingdom', 'Germany', 'Canada', 'United States', 'Netherlands', 'Australia', 'Sweden', 'France']), // prettier-ignore
};

const businessText = (d: Data) =>
  lower([d.description, ...(d.service_lines ?? []), ...(d.industries ?? []), ...(d.products_services ?? [])]);
const sectorsIn = (text: string) => SECTORS.filter((s) => s.keys.some((k) => text.includes(k)));

export const suggestBusiness = {
  serviceLines: (d: Data) =>
    fresh(
      d.service_lines,
      sectorsIn(businessText(d)).flatMap((s) => s.services),
    ),
  products: (d: Data) =>
    fresh(
      d.products_services,
      sectorsIn(businessText(d)).flatMap((s) => s.products ?? []),
    ),
  industries: (d: Data) =>
    fresh(
      d.industries,
      sectorsIn(businessText(d)).map((s) => s.sector),
    ),
  certifications: (d: Data) =>
    fresh(d.certifications, [
      ...sectorsIn(businessText(d)).flatMap((s) => s.certifications ?? []),
      'ISO 9001',
    ]),
  licences: (d: Data) => fresh(d.licenses, LICENCES.slice(0, 4)),
  geographies: (d: Data) =>
    fresh(
      d.preferred_geographies,
      [...(d.operating_locations ?? []), d.registration_country].filter(Boolean),
    ),
  buyers: (d: Data) => fresh(d.preferred_buyers, BUYERS),
};

/** "united kingdom" → "United Kingdom"; unknown text is returned as typed. */
export function displayCountry(c: string): string {
  const canon = canonicalCountry(c);
  return COUNTRY_NAMES.find((n) => canonicalCountry(n) === canon) ?? c;
}

/** Type-ahead: options starting with the text first, then containing it. */
export function filterOptions(options: string[], text: string, exclude: string[] = [], limit = 8): string[] {
  const q = text.trim().toLowerCase();
  if (!q) return [];
  const skip = new Set(exclude.map((x) => x.toLowerCase()));
  const pool = options.filter((o) => !skip.has(o.toLowerCase()));
  const starts = pool.filter((o) => o.toLowerCase().startsWith(q));
  const words = pool.filter(
    (o) =>
      !starts.includes(o) &&
      o
        .toLowerCase()
        .split(/[\s/-]+/)
        .some((w) => w.startsWith(q)),
  );
  const contains = pool.filter(
    (o) => !starts.includes(o) && !words.includes(o) && o.toLowerCase().includes(q),
  );
  return [...starts, ...words, ...contains].slice(0, limit);
}
