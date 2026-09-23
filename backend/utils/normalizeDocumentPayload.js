import { DOCUMENT_TYPES } from './documentFields.js';

const toDate = (value) => {
  if (value === null) return null;
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export const normalizeDocumentPayload = (body = {}, lockedType) => {
  const type = lockedType || body.type;
  if (!DOCUMENT_TYPES.includes(type)) {
    return { error: `Invalid document type. Must be one of: ${DOCUMENT_TYPES.join(', ')}` };
  }

  return {
    title: String(body.title || '').trim(),
    type,
    description: String(body.description || '').trim(),
    documentUrl: String(body.documentUrl || '').trim(),
    fileName: String(body.fileName || '').trim(),
    status: body.status || 'Active',
    effectiveDate: toDate(body.effectiveDate) || new Date(),
    expiryDate: body.expiryDate === '' || body.expiryDate == null ? null : toDate(body.expiryDate),
    uploadedBy: body.uploadedBy || null,
    client: body.client || null,
    notes: String(body.notes || '').trim(),
  };
};

export const validateDocumentPayload = (payload) => {
  const missing = [];
  if (!payload.title) missing.push('title');
  if (!payload.type) missing.push('type');
  return missing;
};
