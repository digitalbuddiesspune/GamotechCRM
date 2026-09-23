import { Router } from 'express';
import {
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  deleteLead,
  addFollowUp,
} from '../../controllers/gamotechSolution/gamotechSolution_leadController.js';

const router = Router();

router.get('/leads', getLeads);
router.post('/leads', createLead);
router.get('/leads/:id', getLeadById);
router.put('/leads/:id', updateLead);
router.delete('/leads/:id', deleteLead);
router.post('/leads/:id/follow-up', addFollowUp);

export default router;
