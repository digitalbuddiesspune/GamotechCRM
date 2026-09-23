import { Router } from 'express';
import {
  createQuotation,
  getQuotations,
  getQuotationById,
  updateQuotation,
  deleteQuotation,
} from '../../controllers/gamotechSolution/gamotechSolution_quotationController.js';

const router = Router();

router.get('/quotations', getQuotations);
router.post('/quotations', createQuotation);
router.get('/quotations/:id', getQuotationById);
router.put('/quotations/:id', updateQuotation);
router.delete('/quotations/:id', deleteQuotation);

export default router;
