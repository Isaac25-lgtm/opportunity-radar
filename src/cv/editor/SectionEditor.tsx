import type { ReactNode } from 'react';
import { dateRange, rid, type CvData, type CvSectionKey } from '../../../shared/cv';
import { TextArea } from '../../components/ui';
import { Items, LevelItems } from './fields';

/** Form controls for each CV section. Content is only ever what the user typed or imported. */
export const SECTION_TIPS: Partial<Record<CvSectionKey, string>> = {
  experience: 'Show your relevant experience (last 10 years). Use bullet points to note achievements.',
  education: 'Include your most relevant education, with dates.',
  skills: 'Choose 5 important skills that show you fit the position.',
  publications: 'List peer-reviewed work first.',
};

export function SectionEditor({
  section,
  data: d,
  onChange: setData,
}: {
  section: CvSectionKey;
  data: CvData;
  onChange: (fn: (d: CvData) => CvData) => void;
}) {
  const editors: Record<CvSectionKey, ReactNode> = {
    summary: (
      <TextArea
        label="Write 2–4 short, energetic sentences about your experience and what you offer."
        rows={6}
        value={d.summary}
        onChange={(e) => setData((x) => ({ ...x, summary: e.target.value }))}
        hint={`${d.summary.length} characters — recommended 200–600.`}
      />
    ),
    experience: (
      <Items
        items={d.experience}
        onChange={(v) => setData((x) => ({ ...x, experience: v }))}
        title={(e) => [e.title, e.employer].filter(Boolean).join(' at ')}
        subtitle={(e) => dateRange(e.start, e.end, e.current)}
        blank={() => ({
          id: rid(),
          title: '',
          employer: '',
          location: '',
          start: '',
          end: '',
          current: false,
          description: '',
        })}
        addLabel={d.experience.length ? 'Add one more employment' : 'Add employment'}
        fields={[
          { key: 'title', label: 'Job title' },
          { key: 'employer', label: 'Employer' },
          { key: 'start', label: 'Start date', type: 'month' },
          { key: 'end', label: 'End date', type: 'month' },
          { key: 'current', label: 'I currently work here', type: 'checkbox' },
          { key: 'location', label: 'City', wide: true },
          {
            key: 'description',
            label: 'Description',
            type: 'textarea',
            hint: 'Start each line with “-” for a bullet. Use real results — only include numbers you can stand behind.',
            placeholder: '- Managed…\n- Delivered…',
          },
        ]}
      />
    ),
    education: (
      <Items
        items={d.education}
        onChange={(v) => setData((x) => ({ ...x, education: v }))}
        title={(e) => [e.degree, e.institution].filter(Boolean).join(', ')}
        subtitle={(e) => dateRange(e.start, e.end)}
        blank={() => ({
          id: rid(),
          degree: '',
          institution: '',
          location: '',
          start: '',
          end: '',
          grade: '',
          details: '',
        })}
        addLabel={d.education.length ? 'Add one more education' : 'Add education'}
        fields={[
          { key: 'institution', label: 'School / university' },
          { key: 'degree', label: 'Degree / qualification' },
          { key: 'start', label: 'Start date', type: 'month' },
          { key: 'end', label: 'End date', type: 'month' },
          { key: 'location', label: 'City' },
          { key: 'grade', label: 'Grade / class' },
          { key: 'details', label: 'Description', type: 'textarea' },
        ]}
      />
    ),
    skills: (
      <LevelItems
        items={d.skills}
        onChange={(v) => setData((x) => ({ ...x, skills: v }))}
        levels={['Novice', 'Beginner', 'Skilful', 'Experienced', 'Expert']}
        placeholder="Add skills, separated by commas"
        addLabel="Add skill"
      />
    ),
    languages: (
      <LevelItems
        items={d.languages}
        onChange={(v) => setData((x) => ({ ...x, languages: v }))}
        levels={['Native', 'Fluent', 'Professional', 'Conversational', 'Basic']}
        placeholder="e.g. English, Luganda"
        addLabel="Add language"
      />
    ),
    projects: (
      <Items
        items={d.projects}
        onChange={(v) => setData((x) => ({ ...x, projects: v }))}
        title={(e) => e.name}
        subtitle={(e) => e.role}
        blank={() => ({ id: rid(), name: '', role: '', link: '', description: '' })}
        addLabel="Add project"
        fields={[
          { key: 'name', label: 'Project name' },
          { key: 'role', label: 'Your role' },
          { key: 'link', label: 'Link', wide: true },
          { key: 'description', label: 'Description', type: 'textarea' },
        ]}
      />
    ),
    certifications: (
      <Items
        items={d.certifications}
        onChange={(v) => setData((x) => ({ ...x, certifications: v }))}
        title={(e) => e.name}
        subtitle={(e) => [e.issuer, e.date].filter(Boolean).join(', ')}
        blank={() => ({ id: rid(), name: '', issuer: '', date: '' })}
        addLabel="Add certification"
        fields={[
          { key: 'name', label: 'Certification', wide: true },
          { key: 'issuer', label: 'Issuer' },
          { key: 'date', label: 'Year' },
        ]}
      />
    ),
    publications: (
      <Items
        items={d.publications}
        onChange={(v) => setData((x) => ({ ...x, publications: v }))}
        title={(e) => e.title}
        subtitle={(e) => [e.venue, e.year].filter(Boolean).join(', ')}
        blank={() => ({ id: rid(), title: '', venue: '', year: '', link: '' })}
        addLabel="Add publication"
        fields={[
          { key: 'title', label: 'Title', wide: true },
          { key: 'venue', label: 'Journal / venue' },
          { key: 'year', label: 'Year' },
          { key: 'link', label: 'Link / DOI', wide: true },
        ]}
      />
    ),
    awards: (
      <Items
        items={d.awards}
        onChange={(v) => setData((x) => ({ ...x, awards: v }))}
        title={(e) => e.title}
        subtitle={(e) => [e.issuer, e.year].filter(Boolean).join(', ')}
        blank={() => ({ id: rid(), title: '', issuer: '', year: '' })}
        addLabel="Add award"
        fields={[
          { key: 'title', label: 'Award', wide: true },
          { key: 'issuer', label: 'Issuer' },
          { key: 'year', label: 'Year' },
        ]}
      />
    ),
    memberships: (
      <Items
        items={d.memberships}
        onChange={(v) => setData((x) => ({ ...x, memberships: v }))}
        title={(e) => e.name}
        subtitle={(e) => e.role}
        blank={() => ({ id: rid(), name: '', role: '' })}
        addLabel="Add membership"
        fields={[
          { key: 'name', label: 'Organisation' },
          { key: 'role', label: 'Role' },
        ]}
      />
    ),
    references: (
      <TextArea
        label="References"
        rows={4}
        placeholder="e.g. Available on request"
        value={d.references}
        onChange={(e) => setData((x) => ({ ...x, references: e.target.value }))}
      />
    ),
  };
  return <>{editors[section]}</>;
}
