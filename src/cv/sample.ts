import { cvDataSchema, type CvData } from '../../shared/cv';

/**
 * Illustrative sample CV used only on marketing pages and template previews.
 * The person, employers and figures are fictional; contact details use reserved example ranges.
 */
export const SAMPLE_CV: CvData = cvDataSchema.parse({
  personal: {
    fullName: 'Sophia Laurent',
    headline: 'Chief Operating Officer',
    email: 'sophia.laurent@example.com',
    phone: '+44 20 7946 0000',
    location: 'London, United Kingdom',
    linkedin: 'linkedin.com/in/sample',
  },
  summary:
    'Operations executive with 15 years leading multi-country businesses through growth and transformation. Scaled organisations of 1,200+ people across Europe, Africa and the Middle East, grew regional revenue to $420M and delivered sustained double-digit margin improvement. Board-level experience in M&A integration, digital transformation and ESG reporting.',
  experience: [
    {
      id: 'e1',
      title: 'Chief Operating Officer',
      employer: 'Global Logistics Group',
      location: 'London',
      start: '2021-01',
      end: '',
      current: true,
      description:
        '- Lead operations in 18 countries with 1,200 staff, reporting to the CEO and board\n- Delivered $38M in annual savings through network redesign and warehouse automation\n- Integrated two acquisitions four months ahead of plan, retaining 96% of key customers',
    },
    {
      id: 'e2',
      title: 'Vice President, Operations — EMEA',
      employer: 'International Health Network',
      location: 'Dubai',
      start: '2016-03',
      end: '2020-12',
      current: false,
      description:
        '- Grew regional revenue from $140M to $260M while improving operating margin by 6 points\n- Launched operations in nine new markets and built a shared-services centre for 22 countries',
    },
    {
      id: 'e3',
      title: 'Senior Manager, Strategy & Operations',
      employer: 'Global Advisory Partners',
      location: 'Johannesburg',
      start: '2011-06',
      end: '2016-02',
      current: false,
      description: '- Led operating-model redesigns for listed clients in banking, telecoms and retail',
    },
  ],
  education: [
    {
      id: 'd1',
      degree: 'MBA',
      institution: 'London Business School',
      location: 'London',
      start: '2009',
      end: '2010',
      grade: 'Distinction',
      details: '',
    },
    {
      id: 'd2',
      degree: 'BSc Economics',
      institution: 'University of Cape Town',
      location: 'Cape Town',
      start: '2003',
      end: '2006',
      grade: '',
      details: '',
    },
  ],
  skills: [
    { id: 's1', name: 'Operating strategy', level: 'Expert' },
    { id: 's2', name: 'P&L leadership', level: 'Expert' },
    { id: 's3', name: 'M&A integration', level: 'Expert' },
    { id: 's4', name: 'Digital transformation', level: 'Advanced' },
    { id: 's5', name: 'Board & investor relations', level: 'Expert' },
    { id: 's6', name: 'Supply chain', level: 'Advanced' },
  ],
  languages: [
    { id: 'l1', name: 'English', level: 'Native' },
    { id: 'l2', name: 'French', level: 'Fluent' },
    { id: 'l3', name: 'Arabic', level: 'Conversational' },
  ],
  certifications: [
    { id: 'c1', name: 'Diploma in Company Direction', issuer: 'Institute of Directors', date: '2022' },
    { id: 'c2', name: 'Lean Six Sigma Black Belt', issuer: '', date: '2014' },
  ],
  awards: [
    { id: 'a1', title: 'Operations Leader of the Year (finalist)', issuer: 'Industry awards', year: '2023' },
  ],
});
