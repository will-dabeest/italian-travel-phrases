import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const checklistPath = resolve(process.cwd(), 'REACT_PARITY_CHECKLIST.md');
const content = readFileSync(checklistPath, 'utf8');
const normalizedContent = content.toLowerCase().replace(/\s+/g, ' ').trim();

const requiredHeadings = [
  '# React Parity Checklist (Executable QA)',
  '## 2) Global Gates',
  '## 3) Fixture Setup Snippets',
  '## 5) Parity Decision Rule',
  '## 6) Evidence Log Template'
];

const requiredStepTitles = [
  'Roadmap Behavioral Parity',
  'Detailed Practice Parity',
  'Pronunciation Flow Parity',
  'Phrases Mode Parity',
  'Settings/System/PWA Parity'
];

const requiredGateLines = ['`npm run check`', '`npm run build`', '`npm run build:react`'];

const missingHeadings = requiredHeadings.filter((heading) => !content.includes(heading));
const missingGateLines = requiredGateLines.filter((line) => !content.includes(line));
const checkboxCount = (content.match(/^- \[ \] /gm) ?? []).length;
const missingSteps = requiredStepTitles.filter((title) => {
  const pattern = new RegExp(`##\\s*step\\s*\\d+\\s*[—-]\\s*${escapeRegExp(title)}`, 'i');
  return !pattern.test(content);
});

if (missingHeadings.length > 0) {
  console.error('Missing required checklist headings:');
  for (const heading of missingHeadings) console.error(`- ${heading}`);
  process.exit(1);
}

if (missingGateLines.length > 0) {
  console.error('Missing required global gate lines:');
  for (const line of missingGateLines) console.error(`- ${line}`);
  process.exit(1);
}

if (missingSteps.length > 0) {
  console.error('Missing required checklist step sections:');
  for (const step of missingSteps) console.error(`- ${step}`);
  process.exit(1);
}

if (!normalizedContent.includes('global gates pass')) {
  console.error('Missing decision rule language requiring global gates to pass.');
  process.exit(1);
}

if (checkboxCount < 20) {
  console.error(`Checklist appears too small (${checkboxCount} checkboxes found). Expected at least 20.`);
  process.exit(1);
}

console.log(`Checklist validation passed (${checkboxCount} checkboxes found).`);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
