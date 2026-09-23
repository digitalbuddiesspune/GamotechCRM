import { Router } from 'express';
import {
  createCollaborator,
  getCollaborators,
  getCollaboratorById,
  updateCollaborator,
  deleteCollaborator,
} from '../../controllers/gamotechSolution/gamotechSolution_collaboratorController.js';

const router = Router();

router.get('/collaborators', getCollaborators);
router.post('/collaborators', createCollaborator);
router.get('/collaborators/:id', getCollaboratorById);
router.put('/collaborators/:id', updateCollaborator);
router.delete('/collaborators/:id', deleteCollaborator);

export default router;
