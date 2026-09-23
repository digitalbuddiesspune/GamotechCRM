import { normalizeDocumentPayload, validateDocumentPayload } from './normalizeDocumentPayload.js';
import { createUploadHandlers } from './createUploadHandlers.js';

const populateOptions = [
  { path: 'uploadedBy', select: 'name email' },
  { path: 'client', select: 'clientName mailId clientNumber' },
];

const getError = (error, fallback) => {
  if (!error) return { status: 500, message: fallback };
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors || {}).map((e) => e.message);
    return { status: 400, message: messages.join(', ') || error.message || fallback };
  }
  return { status: 500, message: error.message || fallback };
};

export const createDocumentController = (Document, { tenantKey = 'common' } = {}) => {
  const { uploadFile, createPresignedUpload } = createUploadHandlers({ tenantKey });

  /** Back-compat document upload — defaults folder to documents. */
  const uploadDocument = async (req, res) => {
    if (!req.body) req.body = {};
    if (!req.body.folder) req.body.folder = 'documents';
    return uploadFile(req, res);
  };

  const createDocumentPresignedUpload = async (req, res) => {
    if (!req.body) req.body = {};
    if (!req.body.folder) req.body.folder = 'documents';
    return createPresignedUpload(req, res);
  };

  const listByType = (documentType) => async (req, res) => {
    try {
      const filter = { type: documentType };
      if (req.query.status) filter.status = req.query.status;
      if (req.query.client) filter.client = req.query.client;
      const documents = await Document.find(filter)
        .populate(populateOptions)
        .sort({ createdAt: -1 });
      res.status(200).json(documents);
    } catch (error) {
      const { status, message } = getError(error, 'Error fetching documents');
      res.status(status).json({ message });
    }
  };

  const createByType = (documentType) => async (req, res) => {
    try {
      const payload = normalizeDocumentPayload(req.body, documentType);
      if (payload.error) return res.status(400).json({ message: payload.error });
      const missing = validateDocumentPayload(payload);
      if (missing.length) {
        return res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` });
      }
      const document = await Document.create(payload);
      const populated = await Document.findById(document._id).populate(populateOptions);
      res.status(201).json({ message: 'Document created successfully', document: populated });
    } catch (error) {
      const { status, message } = getError(error, 'Error creating document');
      res.status(status).json({ message });
    }
  };

  const getById = async (req, res) => {
    try {
      const document = await Document.findById(req.params.id).populate(populateOptions);
      if (!document) return res.status(404).json({ message: 'Document not found' });
      res.status(200).json(document);
    } catch (error) {
      const { status, message } = getError(error, 'Error fetching document');
      res.status(status).json({ message });
    }
  };

  const updateByType = (documentType) => async (req, res) => {
    try {
      const existing = await Document.findById(req.params.id);
      if (!existing) return res.status(404).json({ message: 'Document not found' });
      if (existing.type !== documentType) {
        return res.status(400).json({ message: `This document is not a ${documentType}` });
      }

      const payload = normalizeDocumentPayload(req.body, documentType);
      if (payload.error) return res.status(400).json({ message: payload.error });
      const missing = validateDocumentPayload(payload);
      if (missing.length) {
        return res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` });
      }

      const updated = await Document.findByIdAndUpdate(req.params.id, payload, {
        new: true,
        runValidators: true,
      }).populate(populateOptions);

      res.status(200).json({ message: 'Document updated successfully', document: updated });
    } catch (error) {
      const { status, message } = getError(error, 'Error updating document');
      res.status(status).json({ message });
    }
  };

  const deleteByType = (documentType) => async (req, res) => {
    try {
      const existing = await Document.findById(req.params.id);
      if (!existing) return res.status(404).json({ message: 'Document not found' });
      if (existing.type !== documentType) {
        return res.status(400).json({ message: `This document is not a ${documentType}` });
      }
      await Document.findByIdAndDelete(req.params.id);
      res.status(200).json({ message: 'Document deleted successfully' });
    } catch (error) {
      const { status, message } = getError(error, 'Error deleting document');
      res.status(status).json({ message });
    }
  };

  return {
    uploadDocument,
    uploadFile,
    createPresignedUpload,
    createDocumentPresignedUpload,
    listByType,
    createByType,
    getById,
    updateByType,
    deleteByType,
  };
};
