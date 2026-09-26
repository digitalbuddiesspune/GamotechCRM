import { Router } from 'express';
import Lead from '../../models/gamotechSolution/gamotechSolution_lead.js';
import Employee from '../../models/gamotechSolution/gamotechSolution_employee.js';
import { createAdsWebhookHandlers } from '../../utils/createAdsWebhookHandlers.js';

const router = Router();

const {
  verifyMetaWebhook,
  receiveMetaWebhook,
  receiveGoogleAdsWebhook,
  receiveGenericAdsWebhook,
} = createAdsWebhookHandlers({
  Lead,
  Employee,
  tenantKey: 'gamotechSolution',
});

/** Meta Developer → Webhooks → Verify & Subscribe (leadgen) */
router.get('/webhooks/meta', verifyMetaWebhook);
router.post('/webhooks/meta', receiveMetaWebhook);

/** Google Ads Lead Form Extension */
router.post('/webhooks/google-ads', receiveGoogleAdsWebhook);

/** Zapier / Make / custom integrations */
router.post('/webhooks/ads', receiveGenericAdsWebhook);

export default router;
