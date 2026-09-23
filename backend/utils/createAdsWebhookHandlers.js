/**
 * Meta + Google Ads lead form webhooks → CRM Lead.
 *
 * Endpoints (per tenant):
 *   GET  /webhooks/meta          — Meta subscription verification
 *   POST /webhooks/meta          — Meta leadgen notifications
 *   POST /webhooks/google-ads    — Google Lead Form Extension webhook
 *   POST /webhooks/ads           — Generic / Zapier / Make.com payload
 */

const TENANT_ENV = {
  gamotechSolution: {
    ownerEmail: 'GAMOTECH_ADS_LEAD_OWNER_EMAIL',
    ownerId: 'GAMOTECH_ADS_LEAD_OWNER_ID',
    metaToken: 'GAMOTECH_META_PAGE_ACCESS_TOKEN',
    googleKey: 'GAMOTECH_GOOGLE_ADS_WEBHOOK_KEY',
  },
};

const pick = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const s = String(value).trim();
    if (s) return s;
  }
  return '';
};

const normalizeKey = (key = '') =>
  String(key)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const PHONE_KEYS = new Set([
  'phone',
  'phonenumber',
  'mobile',
  'mobilenumber',
  'contact',
  'contactnumber',
  'userphone',
  'telephone',
  'whatsapp',
]);

const NAME_KEYS = new Set([
  'name',
  'fullname',
  'username',
  'contactname',
  'leadname',
]);

const FIRST_NAME_KEYS = new Set(['firstname', 'first', 'givenname']);
const LAST_NAME_KEYS = new Set(['lastname', 'last', 'surname', 'familyname']);

const EMAIL_KEYS = new Set(['email', 'emailaddress', 'useremail', 'mail']);
const CITY_KEYS = new Set(['city', 'town']);
const STATE_KEYS = new Set(['state', 'province', 'region']);
const ADDRESS_KEYS = new Set(['address', 'streetaddress', 'street', 'fulladdress']);
const COMPANY_KEYS = new Set([
  'company',
  'companyname',
  'business',
  'businessname',
  'organization',
  'organisation',
]);

const mapFromFieldMap = (fields = {}) => {
  let firstName = '';
  let lastName = '';
  const mapped = {
    name: '',
    contactNumber: '',
    email: '',
    city: '',
    state: '',
    address: '',
    businessName: '',
  };

  for (const [rawKey, rawValue] of Object.entries(fields)) {
    const key = normalizeKey(rawKey);
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    const text = pick(value);
    if (!text) continue;

    if (PHONE_KEYS.has(key) && !mapped.contactNumber) mapped.contactNumber = text;
    else if (EMAIL_KEYS.has(key) && !mapped.email) mapped.email = text;
    else if (CITY_KEYS.has(key) && !mapped.city) mapped.city = text;
    else if (STATE_KEYS.has(key) && !mapped.state) mapped.state = text;
    else if (ADDRESS_KEYS.has(key) && !mapped.address) mapped.address = text;
    else if (COMPANY_KEYS.has(key) && !mapped.businessName) mapped.businessName = text;
    else if (NAME_KEYS.has(key) && !mapped.name) mapped.name = text;
    else if (FIRST_NAME_KEYS.has(key) && !firstName) firstName = text;
    else if (LAST_NAME_KEYS.has(key) && !lastName) lastName = text;
  }

  if (!mapped.name) {
    mapped.name = pick(`${firstName} ${lastName}`.trim());
  }

  return mapped;
};

const metaFieldDataToMap = (fieldData = []) => {
  const map = {};
  for (const item of fieldData) {
    const name = item?.name || item?.column_name || '';
    const values = item?.values ?? item?.string_value ?? item?.value;
    if (!name) continue;
    map[name] = Array.isArray(values) ? values[0] : values;
  }
  return map;
};

const googleColumnsToMap = (columns = []) => {
  const map = {};
  for (const item of columns) {
    const name = item?.column_name || item?.name || '';
    const value = item?.string_value ?? item?.value ?? item?.values?.[0];
    if (!name) continue;
    map[name] = value;
  }
  return map;
};

const fetchMetaLead = async (leadgenId, accessToken) => {
  const url = new URL(`https://graph.facebook.com/v21.0/${encodeURIComponent(leadgenId)}`);
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('fields', 'id,created_time,ad_id,adset_id,campaign_id,form_id,field_data');

  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `Meta Graph API error (${response.status})`;
    const err = new Error(message);
    err.status = response.status;
    err.details = data;
    throw err;
  }
  return data;
};

export function createAdsWebhookHandlers({ Lead, Employee, tenantKey }) {
  const envKeys = TENANT_ENV[tenantKey];
  if (!envKeys) {
    throw new Error(`Unsupported ads webhook tenant: ${tenantKey}`);
  }

  const resolveOwnerId = async () => {
    const ownerId = pick(process.env[envKeys.ownerId]);
    if (ownerId) return ownerId;

    const ownerEmail = pick(process.env[envKeys.ownerEmail]);
    if (ownerEmail) {
      const byEmail = await Employee.findOne({
        email: new RegExp(`^${ownerEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        status: 'Active',
      }).select('_id');
      if (byEmail) return byEmail._id;
    }

    const fallback = await Employee.findOne({ status: 'Active' }).sort({ createdAt: 1 }).select('_id');
    return fallback?._id || null;
  };

  const getMetaToken = () =>
    pick(process.env[envKeys.metaToken], process.env.META_PAGE_ACCESS_TOKEN);

  const getGoogleKey = () =>
    pick(process.env[envKeys.googleKey], process.env.GOOGLE_ADS_WEBHOOK_KEY);

  const getVerifyToken = () =>
    pick(process.env.META_WEBHOOK_VERIFY_TOKEN, 'multicrm-meta-verify');

  const upsertAdsLead = async ({
    mapped,
    leadSource,
    adPlatform,
    externalLeadId,
    campaignId,
    adId,
    formId,
    rawPayload,
    extraDescription = '',
  }) => {
    const name = pick(mapped.name, 'Unknown Lead');
    const contactNumber = pick(mapped.contactNumber);
    if (!contactNumber) {
      const err = new Error('Lead is missing a phone number');
      err.status = 400;
      throw err;
    }

    if (externalLeadId) {
      const existing = await Lead.findOne({ externalLeadId, adPlatform });
      if (existing) {
        return { lead: existing, created: false };
      }
    }

    const generatedBy = await resolveOwnerId();
    if (!generatedBy) {
      const err = new Error(
        `No employee found to own ads leads. Set ${envKeys.ownerEmail} or create an Active employee.`
      );
      err.status = 500;
      throw err;
    }

    const descriptionParts = [
      pick(mapped.email) ? `Email: ${mapped.email}` : '',
      extraDescription,
      `Imported from ${leadSource}`,
    ].filter(Boolean);

    try {
      const lead = await Lead.create({
        name,
        businessName: pick(mapped.businessName, name, 'N/A'),
        contactNumber,
        email: pick(mapped.email),
        address: pick(mapped.address),
        city: pick(mapped.city),
        state: pick(mapped.state),
        leadSource,
        description: descriptionParts.join('\n'),
        status: 'Call not Received',
        generatedBy,
        externalLeadId: pick(externalLeadId),
        adPlatform,
        campaignId: pick(campaignId),
        adId: pick(adId),
        formId: pick(formId),
        adsRawPayload: rawPayload,
      });
      return { lead, created: true };
    } catch (error) {
      // Concurrent webhook delivery — treat unique index collision as idempotent
      if (error?.code === 11000 && externalLeadId) {
        const existing = await Lead.findOne({ externalLeadId, adPlatform });
        if (existing) return { lead: existing, created: false };
      }
      throw error;
    }
  };

  /** Meta webhook verification (hub.challenge). */
  const verifyMetaWebhook = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token && token === getVerifyToken()) {
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ message: 'Meta webhook verification failed' });
  };

  /** Meta leadgen event — fetch full lead from Graph API and create CRM lead. */
  const receiveMetaWebhook = async (req, res) => {
    try {
      // Acknowledge quickly-friendly: process then respond (sync is fine for CRM volume)
      const body = req.body || {};
      const accessToken = getMetaToken();

      // Direct / Zapier-style Meta payload (already has field_data or flat fields)
      if (body.field_data || body.leadgen_id || body.id || body.name || body.phone || body.phone_number) {
        let mapped;
        let externalLeadId = pick(body.leadgen_id, body.id, body.externalLeadId);
        let campaignId = pick(body.campaign_id, body.campaignId);
        let adId = pick(body.ad_id, body.adId);
        let formId = pick(body.form_id, body.formId);
        let raw = body;

        if (Array.isArray(body.field_data)) {
          mapped = mapFromFieldMap(metaFieldDataToMap(body.field_data));
        } else if (body.leadgen_id && accessToken) {
          const remote = await fetchMetaLead(body.leadgen_id, accessToken);
          mapped = mapFromFieldMap(metaFieldDataToMap(remote.field_data || []));
          externalLeadId = pick(remote.id, externalLeadId);
          campaignId = pick(remote.campaign_id, campaignId);
          adId = pick(remote.ad_id, adId);
          formId = pick(remote.form_id, formId);
          raw = remote;
        } else {
          mapped = mapFromFieldMap(body);
        }

        const { lead, created } = await upsertAdsLead({
          mapped,
          leadSource: 'Meta Ads',
          adPlatform: 'meta',
          externalLeadId,
          campaignId,
          adId,
          formId,
          rawPayload: raw,
        });

        return res.status(created ? 201 : 200).json({
          message: created ? 'Lead created from Meta' : 'Lead already exists',
          leadId: lead._id,
        });
      }

      // Standard Page webhook envelope
      const entries = Array.isArray(body.entry) ? body.entry : [];
      const results = [];

      for (const entry of entries) {
        const changes = Array.isArray(entry.changes) ? entry.changes : [];
        for (const change of changes) {
          if (change?.field !== 'leadgen') continue;
          const value = change.value || {};
          const leadgenId = pick(value.leadgen_id);
          if (!leadgenId) continue;

          if (!accessToken) {
            return res.status(500).json({
              message:
                `META page access token missing. Set ${envKeys.metaToken} or META_PAGE_ACCESS_TOKEN.`,
            });
          }

          const remote = await fetchMetaLead(leadgenId, accessToken);
          const mapped = mapFromFieldMap(metaFieldDataToMap(remote.field_data || []));
          const { lead, created } = await upsertAdsLead({
            mapped,
            leadSource: 'Meta Ads',
            adPlatform: 'meta',
            externalLeadId: pick(remote.id, leadgenId),
            campaignId: pick(remote.campaign_id, value.campaign_id),
            adId: pick(remote.ad_id, value.ad_id),
            formId: pick(remote.form_id, value.form_id),
            rawPayload: { webhook: value, lead: remote },
          });
          results.push({ leadId: lead._id, created });
        }
      }

      // Always 200 for Meta retries when we at least received the ping
      return res.status(200).json({
        message: 'Meta webhook processed',
        results,
      });
    } catch (error) {
      console.error(`[${tenantKey}] Meta webhook error:`, error);
      return res.status(error.status || 500).json({
        message: error.message || 'Failed to process Meta webhook',
        details: error.details,
      });
    }
  };

  /** Google Ads Lead Form Extension webhook. */
  const receiveGoogleAdsWebhook = async (req, res) => {
    try {
      const body = req.body || {};
      const expectedKey = getGoogleKey();
      const providedKey = pick(body.google_key, req.headers['x-google-ads-key'], req.query.key);

      if (expectedKey && providedKey !== expectedKey) {
        return res.status(401).json({ message: 'Invalid Google Ads webhook key' });
      }

      const mapped = mapFromFieldMap({
        ...googleColumnsToMap(body.user_column_data || body.column_data || []),
        ...body,
      });

      const { lead, created } = await upsertAdsLead({
        mapped,
        leadSource: 'Google Ads',
        adPlatform: 'google',
        externalLeadId: pick(body.lead_id, body.gcl_id, body.externalLeadId),
        campaignId: pick(body.campaign_id, body.campaignId),
        adId: pick(body.ad_id, body.creative_id, body.adId),
        formId: pick(body.form_id, body.formId),
        rawPayload: body,
        extraDescription: pick(body.is_test ? 'Google Ads test lead' : ''),
      });

      return res.status(created ? 201 : 200).json({
        message: created ? 'Lead created from Google Ads' : 'Lead already exists',
        leadId: lead._id,
      });
    } catch (error) {
      console.error(`[${tenantKey}] Google Ads webhook error:`, error);
      return res.status(error.status || 500).json({
        message: error.message || 'Failed to process Google Ads webhook',
      });
    }
  };

  /**
   * Generic webhook for Zapier / Make / custom integrations.
   * Body: { name, phone|contactNumber, email?, city?, state?, address?, businessName?, source? }
   * Optional header: x-ads-webhook-key matching GOOGLE_ADS_WEBHOOK_KEY (shared secret).
   */
  const receiveGenericAdsWebhook = async (req, res) => {
    try {
      const body = req.body || {};
      const expectedKey = getGoogleKey();
      const providedKey = pick(req.headers['x-ads-webhook-key'], body.webhook_key, req.query.key);
      if (expectedKey && providedKey && providedKey !== expectedKey) {
        return res.status(401).json({ message: 'Invalid webhook key' });
      }

      const sourceHint = normalizeKey(body.source || body.leadSource || body.platform || '');
      let leadSource = 'Ads';
      let adPlatform = 'other';
      if (sourceHint.includes('meta') || sourceHint.includes('facebook') || sourceHint.includes('instagram')) {
        leadSource = 'Meta Ads';
        adPlatform = 'meta';
      } else if (sourceHint.includes('google')) {
        leadSource = 'Google Ads';
        adPlatform = 'google';
      } else if (pick(body.leadSource)) {
        leadSource = String(body.leadSource).trim();
      }

      const mapped = mapFromFieldMap({
        ...body,
        phone: body.phone || body.contactNumber || body.phone_number,
        name: body.name || body.full_name,
      });

      const { lead, created } = await upsertAdsLead({
        mapped,
        leadSource,
        adPlatform,
        externalLeadId: pick(body.externalLeadId, body.lead_id, body.id),
        campaignId: pick(body.campaign_id, body.campaignId),
        adId: pick(body.ad_id, body.adId),
        formId: pick(body.form_id, body.formId),
        rawPayload: body,
      });

      return res.status(created ? 201 : 200).json({
        message: created ? 'Lead created from ads webhook' : 'Lead already exists',
        leadId: lead._id,
      });
    } catch (error) {
      console.error(`[${tenantKey}] Generic ads webhook error:`, error);
      return res.status(error.status || 500).json({
        message: error.message || 'Failed to process ads webhook',
      });
    }
  };

  return {
    verifyMetaWebhook,
    receiveMetaWebhook,
    receiveGoogleAdsWebhook,
    receiveGenericAdsWebhook,
  };
}
