import { Router } from 'express';
import {
  getMetaCampaigns,
  getMetaTokenStatus,
  updateMetaToken,
} from '../../controllers/gamotechSolution/gamotechSolution_metaCampaignController.js';

const router = Router();

/** Live Meta Ads campaigns via Graph API + CRM lead counts per campaign. */
router.get('/meta/campaigns', getMetaCampaigns);
router.get('/meta/token/status', getMetaTokenStatus);
router.put('/meta/token', updateMetaToken);

export default router;
