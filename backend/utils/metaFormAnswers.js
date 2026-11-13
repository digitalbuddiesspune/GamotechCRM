/**
 * Question/answer pairs from a Meta lead.
 * Graph field_data is used when the webhook stored it.
 * Sheet imports only keep column values, so custom answers are paired
 * with the question text for each known form.
 */

const looksLikePhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
};

const tidy = (value) => String(value ?? '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

const tidyAnswer = (value) => tidy(String(value ?? '').replace(/\|/g, ', '));

const FORM_QUESTIONS = {
  mumbai_leads: [
    'What are you looking for?',
    'When are you planning to start?',
    'What is the current status of your project?',
    'What is your budget?',
  ],
  free_camp: [
    'What do you want to know about?',
    'Would you like to register?',
    'What time works for you?',
  ],
};

const IMPORTED_LINE = /^(Configuration|Used for|Visit|Pickup|Campaign|Campaign ID|Ad|Ad ID|Ad set|Form|Form ID|Platform|Organic|Created|Lead ID|Sheet status|Email):/i;

const rawColumns = (raw) => {
  if (!raw || typeof raw !== 'object') return [];
  return Object.entries(raw)
    .map(([key, value]) => ({
      index: /^c(\d+)$/.test(key) ? Number(key.slice(1)) : null,
      value: String(value ?? '').trim(),
    }))
    .filter((row) => row.index != null && row.value)
    .sort((a, b) => a.index - b.index);
};

const formatWhen = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return tidy(value);
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

export const descriptionWithoutImportedAnswers = (description) =>
  String(description || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !IMPORTED_LINE.test(line))
    .join('\n');

export const buildFormAnswers = ({ lead, sheet } = {}) => {
  const answers = [];
  const push = (question, answer) => {
    const q = String(question || '').trim();
    const a = String(answer ?? '').trim();
    if (!q || !a) return;
    if (answers.some((row) => row.question === q)) return;
    answers.push({ question: q, answer: a });
  };

  const fieldData = Array.isArray(lead?.adsRawPayload?.field_data) ? lead.adsRawPayload.field_data : [];
  if (fieldData.length) {
    for (const field of fieldData) {
      const values = Array.isArray(field?.values) ? field.values : [field?.values];
      push(tidy(field?.name), tidyAnswer(values.filter((value) => String(value ?? '').trim()).join(', ')));
    }
  } else if (sheet?.rawRow) {
    const columns = rawColumns(sheet.rawRow);
    const phone = columns.find((row) => row.index >= 12 && looksLikePhone(row.value));
    const nameIndex = phone ? phone.index - 1 : -1;
    const custom = columns.filter((row) => row.index >= 12 && (nameIndex < 0 || row.index < nameIndex));
    const formKey = String(sheet.formName || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const labels = FORM_QUESTIONS[formKey] || [];
    custom.forEach((row, index) => {
      push(labels[index] || `Question ${index + 1}`, tidyAnswer(row.value));
    });
  }

  const meta = sheet || {};
  const organic = meta.rawRow?.c10;
  push('Campaign', meta.campaignName || lead?.campaignName);
  push('Campaign ID', meta.campaignId || lead?.campaignId);
  push('Ad', meta.adName);
  push('Ad ID', meta.adId || lead?.adId);
  push('Ad set', meta.adsetName);
  push('Form', meta.formName);
  push('Form ID', meta.formId || lead?.formId);
  push('Platform', meta.platform);
  push('Organic', organic === undefined || organic === '' ? '' : String(organic).toLowerCase() === 'true' ? 'Yes' : 'No');
  push('Created', formatWhen(meta.createdTime || meta.rawRow?.c1));
  push('Lead ID', meta.metaLeadId || lead?.externalLeadId);
  push('Email', lead?.email);

  return answers;
};
