import { Router } from 'express';
import {
  createBilling,
  getBillings,
  getBillingById,
  updateBilling,
  deleteBilling,
  getBillingTracking,
} from '../../controllers/gamotechSolution/gamotechSolution_billingController.js';

const router = Router();

router.get('/billing', getBillings);
router.get('/billing/tracking/:clientId', getBillingTracking);
router.post('/billing', createBilling);
router.get('/billing/:id', getBillingById);
router.put('/billing/:id', updateBilling);
router.delete('/billing/:id', deleteBilling);

export default router;
