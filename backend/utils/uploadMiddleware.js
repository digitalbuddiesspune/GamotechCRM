import multer from 'multer';

const storage = multer.memoryStorage();

/** Shared multipart parser for documents, chat, photos, logos, etc. No file size cap. */
export const mediaUpload = multer({
  storage,
});

/** @deprecated Prefer mediaUpload */
export const documentUpload = mediaUpload;
