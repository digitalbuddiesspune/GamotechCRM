import { Router } from 'express';
import {
  createClient,
  getClients,
  getClientById,
  getClientDashboard,
  updateClient,
  deleteClient,
} from '../../controllers/gamotechSolution/gamotechSolution_clientController.js';

const router = Router();

router.get('/clients', getClients);
router.post('/clients', createClient);
router.get('/clients/:id/dashboard', getClientDashboard);
router.get('/clients/:id', getClientById);
router.put('/clients/:id', updateClient);
router.delete('/clients/:id', deleteClient);

export default router;
