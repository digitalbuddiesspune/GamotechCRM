import { Router } from 'express';
import {
  createClientProfile,
  getClientProfiles,
  getClientProfileById,
  getClientProfileByClientId,
  updateClientProfile,
  deleteClientProfile,
} from '../../controllers/gamotechSolution/gamotechSolution_clientProfileController.js';

const router = Router();

router.get('/client-profiles', getClientProfiles);
router.post('/client-profiles', createClientProfile);
router.get('/client-profiles/by-client/:clientId', getClientProfileByClientId);
router.get('/client-profiles/:id', getClientProfileById);
router.put('/client-profiles/:id', updateClientProfile);
router.patch('/client-profiles/:id', updateClientProfile);
router.delete('/client-profiles/:id', deleteClientProfile);

export default router;

