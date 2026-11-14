import Employee from '../models/gamotechSolution/gamotechSolution_employee.js';
import Lead from '../models/gamotechSolution/gamotechSolution_lead.js';
import {
  getConfiguredAdAccountIds,
  graphGet,
  listAdAccounts,
  listCampaignsForAdAccounts,
} from './metaGraphApi.js';
import { resolveMetaAccessToken } from './metaTokenService.js';

const pick = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
};

const normalizeKey = (key = '') => String(key).toLowerCase().replace(/[^a-z0-9]/g, '');

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
const NAME_KEYS = new Set(['name', 'fullname', 'username', 'contactname', 'leadname']);
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

const mapLeadFields = (fieldData = []) => {
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
  const values = [];

  for (const item of fieldData) {
    const key = normalizeKey(item?.name || '');
    const raw = Array.isArray(item?.values) ? item.values[0] : item?.values;
    const text = pick(raw);
    if (!text) continue;
    values.push(text);

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

  if (!mapped.name) mapped.name = pick(`${firstName} ${lastName}`.trim());
  if (!mapped.contactNumber) {
    const phone = values.find((value) => {
      const digits = String(value).replace(/\D/g, '');
      return digits.length >= 10 && digits.length <= 15;
    });
    if (phone) mapped.contactNumber = phone;
  }

  return mapped;
};

const graphAll = async (path, accessToken, query = {}) => {
  const first = await graphGet(path, accessToken, { ...query, limit: '100' });
  const items = [...(first.data || [])];
  let next = first.paging?.next || null;
  let pages = 1;

  while (next && pages < 30) {
    const response = await fetch(next);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data?.error?.message || 'Meta Graph API error');
      err.status = response.status;
      throw err;
    }
    items.push(...(Array.isArray(data.data) ? data.data : []));
    next = data.paging?.next || null;
    pages += 1;
  }

  return items;
};

const resolveAdAccounts = async (accessToken) => {
  const configured = getConfiguredAdAccountIds();
  if (configured?.length) {
    return configured.map((id) => ({ account_id: id, name: id }));
  }
  return listAdAccounts(accessToken);
};

const resolveOwnerId = async () => {
  const ownerId = pick(process.env.GAMOTECH_ADS_LEAD_OWNER_ID);
  if (ownerId) return ownerId;

  const ownerEmail = pick(process.env.GAMOTECH_ADS_LEAD_OWNER_EMAIL);
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

const isActive = (campaign) =>
  String(campaign?.effective_status || campaign?.status || '').toUpperCase() === 'ACTIVE';

/**
 * Copy Meta instant-form leads for active campaigns into the CRM.
 * Existing leads are left unchanged. Pass campaignId to sync one active campaign.
 */
export async function syncActiveCampaignLeads({ campaignId = '' } = {}) {
  const accessToken = await resolveMetaAccessToken();
  if (!accessToken) {
    const err = new Error(
      'Meta access token missing. Add it in Settings → Meta integration or set META_PAGE_ACCESS_TOKEN in backend .env'
    );
    err.status = 503;
    throw err;
  }

  const accounts = await resolveAdAccounts(accessToken);
  const rawCampaigns = accounts.length
    ? await listCampaignsForAdAccounts(accounts, accessToken, 4)
    : [];
  const readable = rawCampaigns.filter((campaign) => campaign && !campaign.__error && campaign.id);
  const requestedId = pick(campaignId);

  let targets = readable.filter(isActive);
  if (requestedId) {
    const match = readable.find((campaign) => String(campaign.id) === requestedId);
    if (!match) {
      const err = new Error('Campaign was not found on the connected ad account.');
      err.status = 404;
      throw err;
    }
    if (!isActive(match)) {
      const err = new Error('This campaign is not active.');
      err.status = 400;
      throw err;
    }
    targets = [match];
  }

  const summary = new Map(
    targets.map((campaign) => [
      String(campaign.id),
      {
        id: String(campaign.id),
        name: pick(campaign.name, `Campaign ${campaign.id}`),
        created: 0,
        alreadyExists: 0,
      },
    ])
  );

  if (!summary.size) {
    return {
      message: 'No active campaigns to fetch.',
      created: 0,
      alreadyExists: 0,
      missingPhone: 0,
      activeCampaigns: 0,
      campaigns: [],
    };
  }

  const ownerId = await resolveOwnerId();
  if (!ownerId) {
    const err = new Error('No Active employee found to own fetched leads.');
    err.status = 500;
    throw err;
  }

  const pagesData = await graphGet('me/accounts', accessToken, {
    fields: 'id,name,access_token',
    limit: '100',
  });
  const pages = (pagesData.data || []).filter((page) => page?.id && page?.access_token);

  let created = 0;
  let alreadyExists = 0;
  let missingPhone = 0;

  for (const page of pages) {
    let forms = [];
    try {
      forms = await graphAll(`${page.id}/leadgen_forms`, page.access_token, {
        fields: 'id,name,status',
      });
    } catch {
      continue;
    }

    for (const form of forms) {
      if (!form?.id) continue;
      let leads = [];
      try {
        leads = await graphAll(`${form.id}/leads`, page.access_token, {
          fields:
            'id,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,field_data,platform,is_organic',
        });
      } catch {
        continue;
      }

      const matching = leads.filter((lead) => summary.has(String(lead?.campaign_id || '')));
      if (!matching.length) continue;

      const ids = matching.map((lead) => String(lead.id)).filter(Boolean);
      const existing = await Lead.find({
        adPlatform: 'meta',
        externalLeadId: { $in: ids },
      })
        .select('externalLeadId')
        .lean();
      const existingIds = new Set(existing.map((row) => row.externalLeadId));

      for (const remote of matching) {
        const externalLeadId = String(remote.id || '');
        const bucket = summary.get(String(remote.campaign_id || ''));
        if (!externalLeadId || !bucket) continue;

        if (existingIds.has(externalLeadId)) {
          alreadyExists += 1;
          bucket.alreadyExists += 1;
          continue;
        }

        const mapped = mapLeadFields(remote.field_data || []);
        if (!mapped.contactNumber) {
          missingPhone += 1;
          continue;
        }

        const campaignName = pick(remote.campaign_name, bucket.name);
        const createdAt = remote.created_time ? new Date(remote.created_time) : new Date();

        try {
          await Lead.create({
            name: pick(mapped.name, 'Unknown Lead').slice(0, 200),
            businessName: pick(mapped.businessName, form.name, campaignName, 'Meta Lead').slice(0, 200),
            contactNumber: mapped.contactNumber.slice(0, 40),
            email: mapped.email,
            address: mapped.address,
            city: mapped.city,
            state: mapped.state,
            leadSource: remote.platform ? `Meta Ads (${remote.platform})` : 'Meta Ads',
            description: [
              campaignName ? `Campaign: ${campaignName}` : '',
              mapped.email ? `Email: ${mapped.email}` : '',
              'Imported from Meta Ads',
            ]
              .filter(Boolean)
              .join('\n'),
            status: 'Call not Received',
            generatedBy: ownerId,
            externalLeadId,
            adPlatform: 'meta',
            campaignId: bucket.id,
            campaignName,
            adId: pick(remote.ad_id),
            formId: pick(remote.form_id, form.id),
            adsRawPayload: remote,
            createdAt,
          });
          existingIds.add(externalLeadId);
          created += 1;
          bucket.created += 1;
        } catch (error) {
          if (error?.code === 11000) {
            alreadyExists += 1;
            bucket.alreadyExists += 1;
            continue;
          }
          throw error;
        }
      }
    }
  }

  const campaigns = [...summary.values()];
  const message = created
    ? `Added ${created} new lead${created === 1 ? '' : 's'} from ${campaigns.filter((row) => row.created).length} active campaign${campaigns.filter((row) => row.created).length === 1 ? '' : 's'}.`
    : 'No new leads. Active campaigns are already up to date.';

  return {
    message,
    created,
    alreadyExists,
    missingPhone,
    activeCampaigns: campaigns.length,
    campaigns,
  };
}
