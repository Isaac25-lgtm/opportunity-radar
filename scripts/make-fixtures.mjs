// Generates sample CV fixtures (fictional person) used by the end-to-end tests.
import { writeFileSync } from 'node:fs';
import { Document, Packer, Paragraph, TextRun } from 'docx';

const LINES = [
  'Brian Okello',
  'Accountant',
  'brian.sample@example.com | +256 701 234567 | Kampala, Uganda',
  '',
  'PROFILE',
  'Accountant with five years of experience in audit and financial reporting for NGOs.',
  '',
  'WORK EXPERIENCE',
  'Accountant | Sample Health NGO',
  'Feb 2021 - Present',
  '- Prepared monthly donor financial reports',
  '- Managed payroll for 40 staff',
  'Audit Assistant at Sample Audit Firm',
  '2018 - 2021',
  '- Supported statutory audits',
  '',
  'EDUCATION',
  'Bachelor of Commerce, Makerere University',
  '2014 - 2017',
  '',
  'SKILLS',
  'Financial reporting, Auditing, QuickBooks, Excel, Payroll',
  '',
  'LANGUAGES',
  'English (Fluent), Luganda (Native)',
];

const doc = new Document({
  sections: [{ children: LINES.map((l) => new Paragraph({ children: [new TextRun(l)] })) }],
});
writeFileSync('tests/fixtures/sample-cv.docx', await Packer.toBuffer(doc));

// Minimal text PDF (Helvetica, one line per text operator) with a correct xref table.
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
let y = 800;
const content = [
  'BT',
  '/F1 11 Tf',
  ...LINES.flatMap((l) => {
    const op = [`1 0 0 1 50 ${y} Tm`, `(${esc(l)}) Tj`];
    y -= 16;
    return op;
  }),
  'ET',
].join('\n');
const objs = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
  `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
];
let pdf = '%PDF-1.4\n';
const offsets = [];
objs.forEach((o, i) => {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
});
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
writeFileSync('tests/fixtures/sample-cv.pdf', pdf);
console.log('fixtures written');
