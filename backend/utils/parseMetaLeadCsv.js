/**
 * Parse Meta / Google Sheet lead CSV exports.
 * Handles quoted fields, messy headers, and the Rohan Nitara column layout.
 */

const normalizeHeader = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const pick = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const s = String(value).trim();
    if (s) return s;
  }
  return '';
};

const parseBool = (value) => {
  const s = String(value || '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
};

const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const normalizePhone = (value) => {
  let phone = String(value || '').trim();
  if (!phone) return '';
  phone = phone.replace(/^p:/i, '').trim();
  phone = phone.replace(/[^\d+]/g, '');
  if (phone.startsWith('+')) {
    phone = `+${phone.slice(1).replace(/\D/g, '')}`;
  } else {
    phone = phone.replace(/\D/g, '');
  }
  return phone;
};

const looksLikePhone = (value) => {
  const digits = normalizePhone(value).replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
};

const looksLikeMetaLeadId = (value) => /^l:\d+/i.test(String(value || '').trim());

/** RFC4180-ish CSV split that keeps newlines inside quotes. */
export const parseCsvText = (text = '') => {
  const input = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const next = input[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    if (ch === '\r') continue;
    field += ch;
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => String(cell || '').trim()));
};

const HEADER_ALIASES = {
  metaleadid: ['meta_lead_id', 'lead_id', 'leadid'],
  createdtime: ['created_time', 'created', 'createdat', 'created_at'],
  adid: ['ad_id', 'adid'],
  adname: ['ad_name', 'adname'],
  adsetid: ['adset_id', 'adsetid'],
  adsetname: ['adset_name', 'adsetname'],
  campaignid: ['campaign_id', 'campaignid'],
  campaignname: ['campaign_name', 'campaignname'],
  formid: ['form_id', 'formid'],
  formname: ['form_name', 'formname'],
  isorganic: ['is_organic', 'organic'],
  platform: ['platform'],
  configurationinterest: [
    'which_configuration_are_you_interested_in',
    'configuration',
    'configuration_interest',
  ],
  propertyusedfor: [
    'this_property_will_be_used_for',
    'property_used_for',
    'usage',
  ],
  visitpreference: [
    'when_can_you_visit_the_site',
    'visit_preference',
    'site_visit',
  ],
  pickuprequested: [
    'would_you_like_complimentary_pickup_drop_for_site_visit',
    'would_you_like_complimentary_pickup_and_drop_for_site_visit',
    'pickup',
    'pickup_requested',
  ],
  fullname: ['full_name', 'name', 'lead_name'],
  phone: ['phone', 'number', 'contact', 'contact_number', 'mobile', 'phone_number'],
  sheetleadstatus: ['lead_status', 'status'],
  executivename: ['executive_name', 'executive', 'assigned_to'],
  remark: ['remark', 'remarks', 'notes', 'comment', 'comments'],
};

const findColumnIndex = (headers, keys) => {
  for (const key of keys) {
    const idx = headers.findIndex((h) => h === key);
    if (idx >= 0) return idx;
  }
  return -1;
};

const buildHeaderIndex = (headerRow = []) => {
  const headers = headerRow.map(normalizeHeader);
  const index = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    index[field] = findColumnIndex(headers, aliases);
  }
  return { headers, index };
};

/**
 * Known positional layout from Rohan Nitara / Meta lead Google Sheet exports.
 * Header row in those files is often corrupted.
 */
const POSITIONAL_MAP = {
  metaleadid: 0,
  createdtime: 1,
  adid: 2,
  adname: 3,
  adsetid: 4,
  adsetname: 5,
  campaignid: 6,
  campaignname: 7,
  formid: 8,
  formname: 9,
  isorganic: 10,
  platform: 11,
  configurationinterest: 12,
  propertyusedfor: 13,
  visitpreference: 14,
  pickuprequested: 15,
  fullname: 16,
  phone: 17,
  sheetleadstatus: 18,
  executivename: 19,
  remark: 20,
};

const shouldUsePositionalLayout = (headerRow = [], dataRows = []) => {
  const headers = headerRow.map(normalizeHeader);
  const blankFirst = !headers[0];
  const duplicateCreated = headers.filter((h) => h === 'created_time').length >= 2;
  const idWhereAdBelongs = headers[2] === 'id' && headers[3] === 'created_time';
  const positionalHits = dataRows
    .slice(0, 10)
    .filter((r) => looksLikeMetaLeadId(r[0]) && looksLikePhone(r[17]))
    .length;
  return blankFirst || duplicateCreated || idWhereAdBelongs || positionalHits >= 2;
};

const cell = (row, idx) => (idx >= 0 && idx < row.length ? row[idx] : '');

const rowToLead = (row, index, usePositional) => {
  const get = (field) => {
    if (usePositional) return cell(row, POSITIONAL_MAP[field] ?? -1);
    return cell(row, index[field] ?? -1);
  };

  let phone = normalizePhone(get('phone'));
  if (!looksLikePhone(phone)) {
    const fallback = row.find((value) => looksLikePhone(value));
    phone = fallback ? normalizePhone(fallback) : phone;
  }

  const fullName = pick(get('fullname'));
  let metaLeadId = pick(get('metaleadid'));
  if (!looksLikeMetaLeadId(metaLeadId)) {
    const fallback = row.find((value) => looksLikeMetaLeadId(value));
    if (fallback) metaLeadId = pick(fallback);
  }

  // Skip junk / header-repeat / empty rows
  if (!fullName || !looksLikePhone(phone)) return null;
  if (normalizeHeader(fullName) === 'full_name') return null;
  if (normalizeHeader(fullName) === 'ad_id') return null;

  return {
    metaLeadId: looksLikeMetaLeadId(metaLeadId) ? metaLeadId : pick(metaLeadId),
    createdTime: parseDate(get('createdtime')),
    adId: pick(get('adid')),
    adName: pick(get('adname')),
    adsetId: pick(get('adsetid')),
    adsetName: pick(get('adsetname')),
    campaignId: pick(get('campaignid')),
    campaignName: pick(get('campaignname')),
    formId: pick(get('formid')),
    formName: pick(get('formname')),
    isOrganic: parseBool(get('isorganic')),
    platform: pick(get('platform')),
    configurationInterest: pick(get('configurationinterest')).replace(/_/g, ' '),
    propertyUsedFor: pick(get('propertyusedfor')).replace(/_/g, ' '),
    visitPreference: pick(get('visitpreference')).replace(/_/g, ' '),
    pickupRequested: pick(get('pickuprequested')).replace(/_/g, ' '),
    fullName,
    phone,
    sheetLeadStatus: pick(get('sheetleadstatus')),
    executiveName: pick(get('executivename')),
    remark: pick(get('remark')),
    rawRow: Object.fromEntries(row.map((value, i) => [`c${i}`, value])),
  };
};

export const parseMetaLeadCsv = (csvText = '') => {
  const rows = parseCsvText(csvText);
  if (!rows.length) {
    return { leads: [], errors: ['CSV is empty'], headerMode: 'none' };
  }

  const { index } = buildHeaderIndex(rows[0]);
  const dataRows = rows.slice(1);
  const usePositional = shouldUsePositionalLayout(rows[0], dataRows);

  const leads = [];
  const errors = [];
  for (let i = 0; i < dataRows.length; i += 1) {
    try {
      const mapped = rowToLead(dataRows[i], index, usePositional);
      if (!mapped) continue;
      leads.push({ ...mapped, _rowNumber: i + 2 });
    } catch (error) {
      errors.push(`Row ${i + 2}: ${error.message || 'parse failed'}`);
    }
  }

  return {
    leads,
    errors,
    headerMode: usePositional ? 'positional' : 'header',
    totalRows: dataRows.length,
  };
};

export const mapSheetStatusToCrmStatus = (sheetStatus = '', tenantId = '') => {
  const s = String(sheetStatus).trim().toLowerCase();
  if (!s || s === 'created' || s === 'new') return 'Call not Received';
  if (s.includes('not interest')) return 'Not Interested';

  if (tenantId === 'salesTechReality') {
    if (s.includes('zoom')) return 'Zoom Meeting';
    if (s.includes('token done') || (s.includes('token') && !s.includes('booking'))) return 'Token Done';
    if (s.includes('booking done') || s.includes('booking')) return 'Booking Done';
    if (s.includes('site visit')) return 'Site Visit';
    if (s.includes('pending')) return 'Pending';
    if (s.includes('interest')) return 'Interested';
    if (s.includes('meeting')) return 'Meeting Schedule';
    if (s.includes('call back') || s.includes('sometime')) return 'Call You After Sometime';
    return 'Call not Received';
  }

  if (s.includes('incentive')) return 'Incentive Earned';
  if (s.includes('token') || s.includes('booking')) return 'Booking Token';
  if (s.includes('revisit')) return 'Meeting Revisit';
  if (s.includes('site visit')) return 'Site Visit';
  if (s.includes('pending')) return 'Pending';
  if (s.includes('interest')) return 'Interested';
  if (s.includes('meeting')) return 'Meeting Schedule';
  if (s.includes('call back') || s.includes('sometime')) return 'Call You After Sometime';
  return 'Call not Received';
};
