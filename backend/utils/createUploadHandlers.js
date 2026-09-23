import { createPresignedPutUrl, uploadFileToS3 } from './s3Upload.js';

const getError = (error, fallback) => {
  if (!error) return { status: 500, message: fallback };
  if (error.statusCode) return { status: error.statusCode, message: error.message || fallback };
  if (error.name === 'MulterError') {
    return { status: 400, message: error.message || fallback };
  }
  return { status: 500, message: error.message || fallback };
};

/**
 * Shared upload handlers for all CRM tenants.
 * Prefer POST /uploads/presign (direct-to-S3). POST /uploads is legacy proxy upload.
 */
export const createUploadHandlers = ({ tenantKey = 'common' } = {}) => {
  /** JSON-only: returns a short-lived S3 PUT URL. File never hits this server. */
  const createPresignedUpload = async (req, res) => {
    try {
      const fileName = String(req.body?.fileName || req.body?.originalName || 'file').trim() || 'file';
      const mimeType = String(req.body?.mimeType || req.body?.contentType || 'application/octet-stream').trim();
      const folder = req.body?.folder || req.query?.folder || 'misc';
      const size = Number(req.body?.size) || 0;

      const prepared = await createPresignedPutUrl({
        originalName: fileName,
        mimeType,
        tenantKey,
        folder,
      });

      res.status(200).json({
        message: 'Presigned upload URL created',
        uploadUrl: prepared.uploadUrl,
        url: prepared.url,
        documentUrl: prepared.url,
        fileName,
        mimeType,
        size,
        key: prepared.key,
        folder: prepared.folder,
        headers: prepared.headers,
        expiresIn: prepared.expiresIn,
      });
    } catch (error) {
      const { status, message } = getError(error, 'Error creating upload URL');
      res.status(status).json({ message });
    }
  };

  /** @deprecated Prefer createPresignedUpload — streams file through API (can 413). */
  const uploadFile = async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'File is required' });

      const folder = req.body?.folder || req.query?.folder || 'misc';
      const uploaded = await uploadFileToS3({
        fileBuffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        tenantKey,
        folder,
      });

      res.status(201).json({
        message: 'File uploaded successfully',
        url: uploaded.url,
        documentUrl: uploaded.url,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype || '',
        size: req.file.size || 0,
        key: uploaded.key,
        folder: uploaded.folder,
      });
    } catch (error) {
      const { status, message } = getError(error, 'Error uploading file');
      res.status(status).json({ message });
    }
  };

  return { uploadFile, createPresignedUpload };
};
