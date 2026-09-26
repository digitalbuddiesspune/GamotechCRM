import { Router } from 'express';
import { getMetaCampaigns } from '../../controllers/gamotechSolution/gamotechSolution_metaCampaignController.js';

const router = Router();

/** Live Meta Ads campaigns via Graph API + CRM lead counts per campaign. */
router.get('/meta/campaigns', getMetaCampaigns);

export default router;
