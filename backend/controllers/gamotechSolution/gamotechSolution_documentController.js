import Document from '../../models/gamotechSolution/gamotechSolution_document.js';
import { createDocumentController } from '../../utils/createDocumentController.js';

const {
  listByType,
  createByType,
  getById,
  updateByType,
  deleteByType,
  uploadDocument,
  uploadFile,
  createPresignedUpload,
  createDocumentPresignedUpload,
} = createDocumentController(Document, { tenantKey: 'gamotechSolution' });

export const getFiles = listByType('File');
export const createFile = createByType('File');
export const updateFile = updateByType('File');
export const deleteFile = deleteByType('File');

export const getContracts = listByType('Contract');
export const createContract = createByType('Contract');
export const updateContract = updateByType('Contract');
export const deleteContract = deleteByType('Contract');

export const getPolicies = listByType('Policy');
export const createPolicy = createByType('Policy');
export const updatePolicy = updateByType('Policy');
export const deletePolicy = deleteByType('Policy');

export const getDocumentById = getById;

export const uploadDocumentFile = uploadDocument;
export const uploadMediaFile = uploadFile;
export const createPresignedUploadUrl = createPresignedUpload;
export const createDocumentPresignedUploadUrl = createDocumentPresignedUpload;
