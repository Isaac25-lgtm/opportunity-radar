import { CV_SECTION_LABELS, dateRange, type CvData, type CvSectionKey } from '../../shared/cv';

/** Builds an ATS-friendly single-column DOCX from structured CV data (docx is loaded on demand). */
export async function cvToDocx(d: CvData): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, AlignmentType } = await import(
    'docx'
  );
  const accent = d.accent.replace('#', '');
  const children: InstanceType<typeof Paragraph>[] = [];
  const p = d.personal;
  children.push(
    new Paragraph({
      children: [new TextRun({ text: p.fullName || 'Your Name', bold: true, size: 44, color: '1E2532' })],
    }),
  );
  if (p.headline)
    children.push(
      new Paragraph({ children: [new TextRun({ text: p.headline, size: 24, color: '303848' })] }),
    );
  const contact = [p.email, p.phone, p.location, p.linkedin, p.website].filter(Boolean).join(' | ');
  if (contact)
    children.push(
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: contact, size: 19, color: '5C6475' })],
      }),
    );

  const heading = (t: string) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CFD5E2', space: 2 } },
      children: [new TextRun({ text: t.toUpperCase(), bold: true, size: 22, color: accent })],
    });
  const text = (t: string, opts: { bold?: boolean; color?: string; size?: number; italics?: boolean } = {}) =>
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: t,
          size: opts.size ?? 21,
          bold: opts.bold,
          color: opts.color,
          italics: opts.italics,
        }),
      ],
    });
  const rich = (t: string) =>
    t
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) =>
        /^[-•*▪●]\s*/.test(l)
          ? new Paragraph({
              bullet: { level: 0 },
              spacing: { after: 20 },
              children: [new TextRun({ text: l.replace(/^[-•*▪●]\s*/, ''), size: 21 })],
            })
          : text(l),
      );

  const keys = d.order.filter((k) => !d.hidden.includes(k));
  for (const k of keys as CvSectionKey[]) {
    const label = CV_SECTION_LABELS[k];
    switch (k) {
      case 'summary':
        if (d.summary.trim()) children.push(heading(label), ...rich(d.summary));
        break;
      case 'experience':
        if (d.experience.length) {
          children.push(heading(label));
          for (const e of d.experience) {
            children.push(
              text([e.title, e.employer].filter(Boolean).join(', ') + (e.location ? `, ${e.location}` : ''), {
                bold: true,
                size: 23,
              }),
            );
            const dr = dateRange(e.start, e.end, e.current);
            if (dr) children.push(text(dr, { color: '5C6475', size: 19 }));
            if (e.description) children.push(...rich(e.description));
          }
        }
        break;
      case 'education':
        if (d.education.length) {
          children.push(heading(label));
          for (const e of d.education) {
            children.push(
              text(
                [e.degree, e.institution].filter(Boolean).join(', ') + (e.location ? `, ${e.location}` : ''),
                { bold: true, size: 23 },
              ),
            );
            const meta = [dateRange(e.start, e.end), e.grade].filter(Boolean).join(' · ');
            if (meta) children.push(text(meta, { color: '5C6475', size: 19 }));
            if (e.details) children.push(...rich(e.details));
          }
        }
        break;
      case 'skills':
        if (d.skills.length)
          children.push(
            heading(label),
            text(d.skills.map((s) => (s.level ? `${s.name} (${s.level})` : s.name)).join(' • ')),
          );
        break;
      case 'languages':
        if (d.languages.length)
          children.push(
            heading(label),
            text(d.languages.map((s) => (s.level ? `${s.name} (${s.level})` : s.name)).join(' • ')),
          );
        break;
      case 'projects':
        if (d.projects.length) {
          children.push(heading(label));
          for (const pr of d.projects) {
            children.push(text(pr.name + (pr.role ? ` — ${pr.role}` : ''), { bold: true }));
            if (pr.link) children.push(text(pr.link, { color: '5C6475', size: 19 }));
            if (pr.description) children.push(...rich(pr.description));
          }
        }
        break;
      case 'certifications':
        if (d.certifications.length) {
          children.push(heading(label));
          for (const c of d.certifications)
            children.push(
              new Paragraph({
                bullet: { level: 0 },
                children: [
                  new TextRun({ text: c.name, bold: true, size: 21 }),
                  new TextRun({
                    text: [c.issuer, c.date].filter(Boolean).length
                      ? ` — ${[c.issuer, c.date].filter(Boolean).join(', ')}`
                      : '',
                    size: 21,
                  }),
                ],
              }),
            );
        }
        break;
      case 'publications':
        if (d.publications.length) {
          children.push(heading(label));
          for (const pb of d.publications)
            children.push(
              new Paragraph({
                bullet: { level: 0 },
                children: [
                  new TextRun({ text: pb.title, size: 21 }),
                  new TextRun({ text: pb.venue ? `. ${pb.venue}` : '', italics: true, size: 21 }),
                  new TextRun({ text: pb.year ? ` (${pb.year})` : '', size: 21 }),
                ],
              }),
            );
        }
        break;
      case 'awards':
        if (d.awards.length) {
          children.push(heading(label));
          for (const a of d.awards)
            children.push(
              new Paragraph({
                bullet: { level: 0 },
                children: [
                  new TextRun({ text: a.title, bold: true, size: 21 }),
                  new TextRun({
                    text: [a.issuer, a.year].filter(Boolean).length
                      ? ` — ${[a.issuer, a.year].filter(Boolean).join(', ')}`
                      : '',
                    size: 21,
                  }),
                ],
              }),
            );
        }
        break;
      case 'memberships':
        if (d.memberships.length) {
          children.push(heading(label));
          for (const m of d.memberships)
            children.push(
              new Paragraph({
                bullet: { level: 0 },
                children: [new TextRun({ text: m.name + (m.role ? ` — ${m.role}` : ''), size: 21 })],
              }),
            );
        }
        break;
      case 'references':
        if (d.references.trim()) children.push(heading(label), ...rich(d.references));
        break;
    }
  }
  const doc = new Document({
    creator: 'Opportunity Radar',
    title: `${p.fullName || 'CV'} — CV`,
    styles: { default: { document: { run: { font: 'Calibri' } } } },
    sections: [
      {
        properties: { page: { margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } },
        children: children.length
          ? children
          : [new Paragraph({ alignment: AlignmentType.LEFT, children: [] })],
      },
    ],
  });
  return Packer.toBlob(doc);
}

export function textToDocx(title: string, body: string): Promise<Blob> {
  return import('docx').then(({ Document, Packer, Paragraph, TextRun }) =>
    Packer.toBlob(
      new Document({
        creator: 'Opportunity Radar',
        title,
        styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
        sections: [
          {
            children: body
              .split('\n')
              .map((l) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun(l)] })),
          },
        ],
      }),
    ),
  );
}

/** Extracts plain text from a PDF or DOCX in the browser. Files never leave the device for parsing. */
export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const buf = await file.arrayBuffer();
  const head = new Uint8Array(buf.slice(0, 5));
  const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46;
  const isZip = head[0] === 0x50 && head[1] === 0x4b;
  if (isPdf && name.endsWith('.pdf')) {
    const pdfjs = await import('pdfjs-dist');
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const pdf = await pdfjs.getDocument({
      data: new Uint8Array(buf),
      isEvalSupported: false,
      disableFontFace: true,
    }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= Math.min(pdf.numPages, 15); i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let line = '';
      let lastY: number | null = null;
      const lines: string[] = [];
      for (const it of content.items as Array<{ str: string; transform: number[]; hasEOL?: boolean }>) {
        const y = Math.round(it.transform[5]);
        if (lastY !== null && Math.abs(y - lastY) > 2) {
          lines.push(line);
          line = '';
        }
        line += (line && !line.endsWith(' ') && it.str && !it.str.startsWith(' ') ? ' ' : '') + it.str;
        lastY = y;
        if (it.hasEOL) {
          lines.push(line);
          line = '';
          lastY = null;
        }
      }
      if (line) lines.push(line);
      pages.push(lines.join('\n'));
    }
    return pages.join('\n');
  }
  if (isZip && name.endsWith('.docx')) {
    const mammoth = (await import('mammoth')) as any;
    const res = await (mammoth.default ?? mammoth).extractRawText({ arrayBuffer: buf });
    return String(res.value ?? '');
  }
  throw new Error('Please upload a PDF or Word (.docx) file.');
}
