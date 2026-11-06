import { cvDataSchema, type CvData } from '../../shared/cv';

/** Illustrative sample CV used only on marketing pages and template previews. The person is fictional. */
export const SAMPLE_CV: CvData = cvDataSchema.parse({
  personal: {
    fullName: 'Grace Achieng',
    headline: 'Monitoring & Evaluation Officer',
    email: 'grace.sample@example.com',
    phone: '+256 700 000 000',
    location: 'Kampala, Uganda',
    linkedin: 'linkedin.com/in/sample',
  },
  summary:
    'M&E officer with five years of experience designing results frameworks and data systems for health and livelihoods programmes in northern and central Uganda. Comfortable leading field data collection, building DHIS2 and KoBo workflows and turning findings into decisions.',
  experience: [
    {
      id: 'e1',
      title: 'Monitoring & Evaluation Officer',
      employer: 'Sample Health Initiative',
      location: 'Gulu',
      start: '2022-03',
      end: '',
      current: true,
      description:
        '- Lead quarterly data quality assessments across 14 facilities\n- Maintain DHIS2 dashboards used by district health teams\n- Train 30 enumerators on KoBo Toolbox data collection',
    },
    {
      id: 'e2',
      title: 'Data Assistant',
      employer: 'Sample Livelihoods Programme',
      location: 'Kampala',
      start: '2019-08',
      end: '2022-02',
      current: false,
      description:
        '- Cleaned and analysed household survey data in Stata\n- Drafted monthly indicator reports for donors',
    },
  ],
  education: [
    {
      id: 'd1',
      degree: 'BSc Statistics',
      institution: 'Makerere University',
      location: 'Kampala',
      start: '2015',
      end: '2019',
      grade: 'Second Class Upper',
      details: '',
    },
  ],
  skills: [
    { id: 's1', name: 'Monitoring and evaluation', level: 'Expert' },
    { id: 's2', name: 'DHIS2', level: 'Advanced' },
    { id: 's3', name: 'Stata', level: 'Advanced' },
    { id: 's4', name: 'KoBo Toolbox', level: 'Advanced' },
    { id: 's5', name: 'Power BI', level: 'Intermediate' },
    { id: 's6', name: 'Report writing', level: 'Expert' },
  ],
  languages: [
    { id: 'l1', name: 'English', level: 'Fluent' },
    { id: 'l2', name: 'Luganda', level: 'Fluent' },
    { id: 'l3', name: 'Acholi', level: 'Conversational' },
  ],
  certifications: [{ id: 'c1', name: 'Results-Based M&E', issuer: 'Sample Institute', date: '2021' }],
  publications: [
    {
      id: 'p1',
      title: 'Facility data quality in post-conflict districts',
      venue: 'Sample Journal of Health Data',
      year: '2023',
      link: '',
    },
  ],
});
