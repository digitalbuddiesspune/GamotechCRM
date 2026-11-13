import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import {
  listCampaignOptions,
  listClientLeadPortals,
  createClientLeadPortal,
  updateClientLeadPortal,
  deleteClientLeadPortal,
  getMyClientLeads,
  getMyClientLead,
  updateMyClientLead,
  saveMyClientLead,
} from '../../controllers/gamotechSolution/gamotechSolution_clientLeadPortalController.js';

const router = Router();

router.get('/client-lead-portals/campaign-options', listCampaignOptions);
router.get('/client-lead-portals', listClientLeadPortals);
router.post('/client-lead-portals', createClientLeadPortal);
router.put('/client-lead-portals/:id', updateClientLeadPortal);
router.delete('/client-lead-portals/:id', deleteClientLeadPortal);

router.get('/client-portal/leads', requireAuth, getMyClientLeads);
router.get('/client-portal/leads/:source/:recordId', requireAuth, getMyClientLead);
router.patch('/client-portal/leads', requireAuth, updateMyClientLead);
router.put('/client-portal/leads/:source/:recordId', requireAuth, saveMyClientLead);

export default router;
