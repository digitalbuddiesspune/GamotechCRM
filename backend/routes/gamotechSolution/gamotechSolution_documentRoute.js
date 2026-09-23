import { Router } from 'express';
import { mediaUpload } from '../../utils/uploadMiddleware.js';
import {
  getFiles,
  createFile,
  updateFile,
  deleteFile,
  getContracts,
  createContract,
  updateContract,
  deleteContract,
  getPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
  getDocumentById,
  uploadDocumentFile,
  uploadMediaFile,
  createPresignedUploadUrl,
  createDocumentPresignedUploadUrl,
} from '../../controllers/gamotechSolution/gamotechSolution_documentController.js';

const router = Router();

router.post('/uploads/presign', createPresignedUploadUrl);
router.post('/documents/upload/presign', createDocumentPresignedUploadUrl);
router.post('/documents/upload', mediaUpload.single('file'), uploadDocumentFile);
router.post('/uploads', mediaUpload.single('file'), uploadMediaFile);

router.get('/files', getFiles);
router.post('/files', createFile);
router.get('/files/:id', getDocumentById);
router.put('/files/:id', updateFile);
router.delete('/files/:id', deleteFile);

router.get('/contracts', getContracts);
router.post('/contracts', createContract);
router.get('/contracts/:id', getDocumentById);
router.put('/contracts/:id', updateContract);
router.delete('/contracts/:id', deleteContract);

router.get('/policies', getPolicies);
router.post('/policies', createPolicy);
router.get('/policies/:id', getDocumentById);
router.put('/policies/:id', updatePolicy);
router.delete('/policies/:id', deletePolicy);

export default router;
