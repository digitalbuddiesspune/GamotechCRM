import bcrypt from 'bcryptjs';
import ClientLeadPortal from '../../models/gamotechSolution/gamotechSolution_clientLeadPortal.js';
import Lead from '../../models/gamotechSolution/gamotechSolution_lead.js';
import SheetLead from '../../models/gamotechSolution/gamotechSolution_sheetLead.js';
import Employee from '../../models/gamotechSolution/gamotechSolution_employee.js';
import { signAuthToken } from '../../utils/jwtAuth.js';
import { syncActiveCampaignLeads } from '../../utils/fetchActiveCampaignLeads.js';
import { buildFormAnswers, descriptionWithoutImportedAnswers } from '../../utils/metaFormAnswers.js';

export const CLIENT_LEAD_STATUSES = [
  'Call not Received',
  'Call You After Sometime',
  'Interested',
  'Not Interested',
  'Meeting Schedule',
];

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const normalizeCampaigns = (campaigns) => {
  if (!Array.isArray(campaigns)) return [];
  const seen = new Set();
  const rows = [];
  for (const item of campaigns) {
    const campaignId = String(item?.campaignId || '').trim();
    const campaignName = String(item?.campaignName || '').trim();
    if (!campaignId && !campaignName) continue;
    const key = `${campaignId}::${campaignName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ campaignId, campaignName });
  }
  return rows;
};

const normalizeLogoUrl = (value) => {
  const url = String(value ?? '').trim();
  if (!url) return '';
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    const err = new Error('Logo must be a valid image address');
    err.status = 400;
    throw err;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    const err = new Error('Logo must be a valid image address');
    err.status = 400;
    throw err;
  }
  return url.slice(0, 2000);
};

const toPublic = (doc) => ({
  _id: doc._id,
  clientName: doc.clientName,
  email: doc.email,
  campaigns: doc.campaigns || [],
  logoUrl: doc.logoUrl || '',
  status: doc.status,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const campaignFilter = (campaigns) => {
  const ids = [...new Set(campaigns.map((c) => c.campaignId).filter(Boolean))];
  const names = [...new Set(campaigns.map((c) => c.campaignName).filter(Boolean))];
  const or = [];
  if (ids.length) or.push({ campaignId: { $in: ids } });
  if (names.length) or.push({ campaignName: { $in: names } });
  return or.length ? { $or: or } : null;
};

const matchesCampaign = (lead, campaigns) => {
  const id = String(lead.campaignId || '').trim();
  const name = String(lead.campaignName || '').trim();
  return campaigns.some(
    (c) => (c.campaignId && c.campaignId === id) || (c.campaignName && c.campaignName === name)
  );
};

const sectionKeyFor = (lead, campaigns) => {
  const id = String(lead.campaignId || '').trim();
  const name = String(lead.campaignName || '').trim();
  const byId = campaigns.find((c) => c.campaignId && c.campaignId === id);
  if (byId) return `${byId.campaignId}::${byId.campaignName}`;
  const byName = campaigns.find((c) => c.campaignName && c.campaignName === name);
  if (byName) return `${byName.campaignId}::${byName.campaignName}`;
  return '';
};

const sheetStatus = (row) => {
  const saved = String(row.clientStatus || '').trim();
  if (CLIENT_LEAD_STATUSES.includes(saved)) return saved;
  return 'Call not Received';
};

const rawValue = (raw, names) => {
  if (!raw || typeof raw !== 'object') return '';
  const wanted = new Set(names.map((name) => name.toLowerCase().replace(/[\s_]/g, '')));
  for (const [key, value] of Object.entries(raw)) {
    const normalized = String(key).toLowerCase().replace(/[\s_]/g, '');
    if (!wanted.has(normalized)) continue;
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
};

const detailLines = (pairs) => pairs
  .map(([label, value]) => [label, String(value ?? '').trim()])
  .filter(([, value]) => value)
  .map(([label, value]) => `${label}: ${value}`)
  .join('\n');

const withFormAnswers = (detail, lead, sheet) => {
  const formAnswers = buildFormAnswers({ lead, sheet });
  return {
    ...detail,
    formAnswers,
    description: formAnswers.length
      ? descriptionWithoutImportedAnswers(detail.description)
      : detail.description,
  };
};

const detailFromCrm = (lead) => {
  const generatedBy = lead.generatedBy && typeof lead.generatedBy === 'object'
    ? { _id: lead.generatedBy._id, name: lead.generatedBy.name || '' }
    : null;
  const extra = detailLines([
    ['Email', lead.email],
    ['Campaign', lead.campaignName],
    ['Campaign ID', lead.campaignId],
    ['Ad', lead.adName],
    ['Ad ID', lead.adId],
    ['Form', lead.formName],
    ['Form ID', lead.formId],
    ['Client note', lead.clientPortalNote],
  ]);
  const description = [String(lead.description || '').trim(), extra].filter(Boolean).join('\n');
  return {
    name: lead.name || '',
    businessName: lead.businessName || '',
    contactNumber: lead.contactNumber || '',
    address: lead.address || '',
    city: lead.city || '',
    state: lead.state || '',
    businessType: lead.businessType || '',
    leadSource: lead.leadSource || '',
    description,
    status: CLIENT_LEAD_STATUSES.includes(lead.status) ? lead.status : 'Call not Received',
    meetingType: lead.meetingType || '',
    meetingPersonName: lead.meetingPersonName || '',
    meetingTime: lead.meetingTime || null,
    meetingInfoSent: Boolean(lead.meetingInfoSent),
    followUps: Array.isArray(lead.followUps) ? lead.followUps : [],
    generatedBy,
    campaignId: lead.campaignId || '',
    campaignName: lead.campaignName || '',
    remark: lead.clientPortalNote || '',
  };
};

const detailFromSheet = (row) => {
  const raw = row.rawRow || {};
  const city = rawValue(raw, ['city']);
  const state = rawValue(raw, ['state']);
  const address = rawValue(raw, ['address', 'fulladdress']);
  const email = rawValue(raw, ['email', 'emailaddress']);
  const businessType = rawValue(raw, ['businesstype', 'business']);
  const description = detailLines([
    ['Email', email],
    ['Campaign', row.campaignName],
    ['Campaign ID', row.campaignId],
    ['Ad', row.adName],
    ['Ad set', row.adsetName],
    ['Form', row.formName],
    ['Platform', row.platform],
    ['Configuration', row.configurationInterest],
    ['Used for', row.propertyUsedFor],
    ['Visit', row.visitPreference],
    ['Pickup', row.pickupRequested],
    ['Sheet remark', row.remark],
    ['Executive', row.executiveName],
    ['Client note', row.clientRemark],
  ]);
  const followUps = [];
  if (String(row.clientRemark || '').trim()) {
    followUps.push({
      date: row.updatedAt || row.importedAt || row.createdTime || new Date(),
      comments: row.clientRemark,
    });
  }
  return {
    name: row.fullName || '',
    businessName: row.formName || row.campaignName || row.fullName || '',
    contactNumber: row.phone || '',
    address,
    city,
    state,
    businessType: businessType || row.configurationInterest || row.propertyUsedFor || '',
    leadSource: row.platform ? `Meta Ads (${row.platform})` : 'Imported lead',
    description,
    status: sheetStatus(row),
    meetingType: '',
    meetingPersonName: '',
    meetingTime: null,
    meetingInfoSent: false,
    followUps,
    generatedBy: row.executiveName ? { name: row.executiveName } : null,
    campaignId: row.campaignId || '',
    campaignName: row.campaignName || '',
    remark: row.clientRemark || '',
  };
};

const savedSheetDetail = (row, detail) => {
  const profile = row.clientProfile && typeof row.clientProfile === 'object' ? row.clientProfile : null;
  if (!profile) return detail;
  return {
    ...detail,
    name: profile.name || detail.name,
    businessName: profile.businessName || detail.businessName,
    contactNumber: profile.contactNumber || detail.contactNumber,
    address: profile.address ?? detail.address,
    city: profile.city ?? detail.city,
    state: profile.state ?? detail.state,
    businessType: profile.businessType ?? detail.businessType,
    leadSource: profile.leadSource || detail.leadSource,
    description: profile.description !== undefined ? profile.description : detail.description,
    meetingType: profile.meetingType || '',
    meetingPersonName: profile.meetingPersonName || '',
    meetingTime: profile.meetingTime || null,
    meetingInfoSent: Boolean(profile.meetingInfoSent),
    followUps: Array.isArray(profile.followUps) ? profile.followUps : detail.followUps,
  };
};

export const loginClientLeadPortal = async (email, password) => {
  const portal = await ClientLeadPortal.findOne({ email: normalizeEmail(email) }).select('+password');
  if (!portal) return null;
  const valid = await bcrypt.compare(password, portal.password);
  if (!valid) return null;
  if (portal.status !== 'Active') {
    const err = new Error('This client dashboard is disabled. Contact your account manager.');
    err.status = 403;
    throw err;
  }

  const user = {
    _id: portal._id,
    name: portal.clientName,
    email: portal.email,
    accountType: 'client_portal',
    campaigns: portal.campaigns,
    logoUrl: portal.logoUrl || '',
    designation: { title: 'Client', accessRole: 'client_portal' },
  };
  const token = signAuthToken({ type: 'client_portal', portalId: String(portal._id) });
  return { user, token };
};

export const listCampaignOptions = async (_req, res) => {
  try {
    const [sheetRows, crmRows] = await Promise.all([
      SheetLead.aggregate([
        {
          $group: {
            _id: { campaignId: { $ifNull: ['$campaignId', ''] }, campaignName: { $ifNull: ['$campaignName', ''] } },
            count: { $sum: 1 },
          },
        },
      ]),
      Lead.aggregate([
        {
          $group: {
            _id: { campaignId: { $ifNull: ['$campaignId', ''] }, campaignName: { $ifNull: ['$campaignName', ''] } },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const map = new Map();
    for (const row of [...sheetRows, ...crmRows]) {
      const campaignId = String(row._id?.campaignId || '').trim();
      const campaignName = String(row._id?.campaignName || '').trim();
      if (!campaignId && !campaignName) continue;
      const key = campaignId || `name::${campaignName}`;
      const current = map.get(key) || { campaignId, campaignName, leadCount: 0 };
      if (!current.campaignName && campaignName) current.campaignName = campaignName;
      current.leadCount += row.count || 0;
      map.set(key, current);
    }

    const campaigns = Array.from(map.values()).sort((a, b) => b.leadCount - a.leadCount || a.campaignName.localeCompare(b.campaignName));
    res.status(200).json({ campaigns });
  } catch (error) {
    res.status(500).json({ message: 'Error loading campaigns', error: error.message });
  }
};

export const listClientLeadPortals = async (_req, res) => {
  try {
    const portals = await ClientLeadPortal.find().sort({ createdAt: -1 }).lean();
    res.status(200).json(portals.map(toPublic));
  } catch (error) {
    res.status(500).json({ message: 'Error loading client dashboards', error: error.message });
  }
};

export const createClientLeadPortal = async (req, res) => {
  try {
    const clientName = String(req.body?.clientName || '').trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const campaigns = normalizeCampaigns(req.body?.campaigns);
    const status = req.body?.status === 'Inactive' ? 'Inactive' : 'Active';
    const logoUrl = normalizeLogoUrl(req.body?.logoUrl);

    if (!clientName || !email || !password) {
      return res.status(400).json({ message: 'Client name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    if (!campaigns.length) {
      return res.status(400).json({ message: 'Select at least one campaign' });
    }

    const employee = await Employee.findOne({ email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).select('_id');
    if (employee) {
      return res.status(409).json({ message: 'This email is already used by an employee' });
    }
    const existing = await ClientLeadPortal.findOne({ email }).select('_id');
    if (existing) {
      return res.status(409).json({ message: 'A client dashboard with this email already exists' });
    }

    const portal = await ClientLeadPortal.create({
      clientName,
      email,
      password: await bcrypt.hash(password, 10),
      campaigns,
      logoUrl,
      status,
    });

    res.status(201).json({
      message: 'Client lead dashboard created',
      portal: toPublic(portal),
      credentials: { email, password },
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error creating client dashboard' });
  }
};

export const updateClientLeadPortal = async (req, res) => {
  try {
    const portal = await ClientLeadPortal.findById(req.params.id).select('+password');
    if (!portal) return res.status(404).json({ message: 'Client dashboard not found' });

    if (req.body?.clientName !== undefined) {
      const clientName = String(req.body.clientName || '').trim();
      if (!clientName) return res.status(400).json({ message: 'Client name is required' });
      portal.clientName = clientName;
    }
    if (req.body?.email !== undefined) {
      const email = normalizeEmail(req.body.email);
      if (!email) return res.status(400).json({ message: 'Email is required' });
      const employee = await Employee.findOne({ email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).select('_id');
      if (employee) return res.status(409).json({ message: 'This email is already used by an employee' });
      const clash = await ClientLeadPortal.findOne({ email, _id: { $ne: portal._id } }).select('_id');
      if (clash) return res.status(409).json({ message: 'A client dashboard with this email already exists' });
      portal.email = email;
    }
    if (req.body?.campaigns !== undefined) {
      const campaigns = normalizeCampaigns(req.body.campaigns);
      if (!campaigns.length) return res.status(400).json({ message: 'Select at least one campaign' });
      portal.campaigns = campaigns;
    }
    if (req.body?.status !== undefined) {
      portal.status = req.body.status === 'Inactive' ? 'Inactive' : 'Active';
    }
    if (req.body?.logoUrl !== undefined) {
      portal.logoUrl = normalizeLogoUrl(req.body.logoUrl);
    }

    let issuedPassword = '';
    if (req.body?.password) {
      const password = String(req.body.password);
      if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
      portal.password = await bcrypt.hash(password, 10);
      issuedPassword = password;
    }

    await portal.save();
    res.status(200).json({
      message: 'Client lead dashboard updated',
      portal: toPublic(portal),
      credentials: issuedPassword ? { email: portal.email, password: issuedPassword } : null,
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error updating client dashboard' });
  }
};

export const deleteClientLeadPortal = async (req, res) => {
  try {
    const portal = await ClientLeadPortal.findByIdAndDelete(req.params.id);
    if (!portal) return res.status(404).json({ message: 'Client dashboard not found' });
    res.status(200).json({ message: 'Client lead dashboard deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting client dashboard', error: error.message });
  }
};

const loadPortalFromAuth = async (req) => {
  const portalId = req.auth?.type === 'client_portal' ? req.auth.portalId : '';
  if (!portalId) {
    const err = new Error('Client login required');
    err.status = 401;
    throw err;
  }
  const portal = await ClientLeadPortal.findById(portalId).lean();
  if (!portal || portal.status !== 'Active') {
    const err = new Error('This client dashboard is disabled');
    err.status = 403;
    throw err;
  }
  return portal;
};

const metaCampaignIdFrom = (value) => String(value || '').trim().replace(/^c:/i, '');

const resolveMetaCampaignId = async (campaign) => {
  const direct = metaCampaignIdFrom(campaign?.campaignId);
  if (/^\d{8,}$/.test(direct)) return direct;

  const name = String(campaign?.campaignName || '').trim();
  if (!name) return '';
  const lead = await Lead.findOne({ campaignName: name, campaignId: { $ne: '' } }).select('campaignId').lean();
  const fromLead = metaCampaignIdFrom(lead?.campaignId);
  if (/^\d{8,}$/.test(fromLead)) return fromLead;
  const sheet = await SheetLead.findOne({ campaignName: name, campaignId: { $ne: '' } }).select('campaignId').lean();
  const fromSheet = metaCampaignIdFrom(sheet?.campaignId);
  return /^\d{8,}$/.test(fromSheet) ? fromSheet : '';
};

export const fetchMyClientLeads = async (req, res) => {
  try {
    const portal = await loadPortalFromAuth(req);
    const requestedId = String(req.body?.campaignId || '').trim();
    const requestedName = String(req.body?.campaignName || '').trim();
    let targets = portal.campaigns || [];
    if (requestedId || requestedName) {
      targets = targets.filter(
        (campaign) =>
          (requestedId && campaign.campaignId === requestedId) ||
          (requestedName && campaign.campaignName === requestedName)
      );
      if (!targets.length) {
        return res.status(403).json({ message: 'This campaign is not on your dashboard.' });
      }
    }
    if (!targets.length) {
      return res.status(400).json({ message: 'No campaign is assigned to this dashboard.' });
    }

    let created = 0;
    let alreadyExists = 0;
    const campaigns = [];
    const errors = [];

    for (const campaign of targets) {
      const metaId = await resolveMetaCampaignId(campaign);
      if (!metaId) {
        errors.push(`${campaign.campaignName || 'This campaign'} is not linked to a Meta campaign.`);
        continue;
      }
      try {
        const result = await syncActiveCampaignLeads({ campaignId: metaId });
        created += result.created || 0;
        alreadyExists += result.alreadyExists || 0;
        campaigns.push(...(result.campaigns || []));
      } catch (error) {
        errors.push(error.message || 'Could not fetch this campaign');
      }
    }

    if (!campaigns.length && errors.length) {
      return res.status(400).json({ message: errors[0], created, alreadyExists, campaigns });
    }

    const message = created
      ? `Added ${created} new lead${created === 1 ? '' : 's'}.`
      : 'No new leads. This campaign is already up to date.';

    return res.status(200).json({ message, created, alreadyExists, campaigns });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || 'Failed to fetch new leads',
    });
  }
};

export const getMyClientLeads = async (req, res) => {
  try {
    const portal = await loadPortalFromAuth(req);
    const filter = campaignFilter(portal.campaigns);
    if (!filter) {
      return res.status(200).json({ clientName: portal.clientName, sections: [] });
    }

    const [crmLeads, sheetLeads] = await Promise.all([
      Lead.find(filter).select('name businessName contactNumber email city status campaignId campaignName leadSource createdAt clientPortalNote').lean(),
      SheetLead.find(filter).select('fullName phone campaignId campaignName platform formName createdTime importedAt clientStatus clientRemark crmLead').lean(),
    ]);

    const crmIds = new Set(crmLeads.map((lead) => String(lead._id)));
    const sections = new Map();
    for (const campaign of portal.campaigns) {
      sections.set(`${campaign.campaignId}::${campaign.campaignName}`, {
        campaignId: campaign.campaignId,
        campaignName: campaign.campaignName || campaign.campaignId,
        leads: [],
      });
    }

    const pushLead = (lead) => {
      const key = sectionKeyFor(lead, portal.campaigns);
      if (!key || !sections.has(key)) return;
      sections.get(key).leads.push(lead);
    };

    for (const lead of crmLeads) {
      if (!matchesCampaign(lead, portal.campaigns)) continue;
      pushLead({
        id: `crm:${lead._id}`,
        source: 'crm',
        recordId: String(lead._id),
        name: lead.name,
        businessName: lead.businessName || '',
        phone: lead.contactNumber || '',
        email: lead.email || '',
        city: lead.city || '',
        campaignId: lead.campaignId || '',
        campaignName: lead.campaignName || '',
        sourceLabel: lead.leadSource || 'CRM',
        createdAt: lead.createdAt,
        status: CLIENT_LEAD_STATUSES.includes(lead.status) ? lead.status : 'Call not Received',
        remark: lead.clientPortalNote || '',
      });
    }

    for (const row of sheetLeads) {
      const linked = row.crmLead ? String(row.crmLead) : '';
      if (linked && crmIds.has(linked)) continue;
      if (!matchesCampaign(row, portal.campaigns)) continue;
      pushLead({
        id: `sheet:${row._id}`,
        source: 'sheet',
        recordId: String(row._id),
        name: row.fullName,
        businessName: row.formName || '',
        phone: row.phone || '',
        email: '',
        city: '',
        campaignId: row.campaignId || '',
        campaignName: row.campaignName || '',
        sourceLabel: row.platform ? `Meta Ads (${row.platform})` : 'Imported lead',
        createdAt: row.createdTime || row.importedAt,
        status: sheetStatus(row),
        remark: row.clientRemark || '',
      });
    }

    const payload = Array.from(sections.values()).map((section) => {
      section.leads.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      return { ...section, leadCount: section.leads.length };
    });

    res.status(200).json({ clientName: portal.clientName, logoUrl: portal.logoUrl || '', sections: payload });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error loading leads' });
  }
};

export const getMyClientLead = async (req, res) => {
  try {
    const portal = await loadPortalFromAuth(req);
    const source = req.params.source === 'sheet' ? 'sheet' : req.params.source === 'crm' ? 'crm' : '';
    const recordId = String(req.params.recordId || '').trim();
    if (!source || !recordId) return res.status(400).json({ message: 'Lead is required' });

    if (source === 'crm') {
      const lead = await Lead.findById(recordId).populate('generatedBy', 'name');
      if (!lead || !matchesCampaign(lead, portal.campaigns)) {
        return res.status(404).json({ message: 'Lead not found for this dashboard' });
      }
      const sheet = lead.externalLeadId
        ? await SheetLead.findOne({ metaLeadId: lead.externalLeadId })
        : null;
      return res.status(200).json(withFormAnswers(detailFromCrm(lead), lead, sheet));
    }

    const row = await SheetLead.findById(recordId);
    if (!row || !matchesCampaign(row, portal.campaigns)) {
      return res.status(404).json({ message: 'Lead not found for this dashboard' });
    }
    if (row.crmLead) {
      const linked = await Lead.findById(row.crmLead).populate('generatedBy', 'name');
      if (linked && matchesCampaign(linked, portal.campaigns)) {
        return res.status(200).json(withFormAnswers(detailFromCrm(linked), linked, row));
      }
    }
    return res.status(200).json(withFormAnswers(savedSheetDetail(row, detailFromSheet(row)), null, row));
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error loading lead' });
  }
};

const clip = (value, max) => String(value ?? '').trim().slice(0, max);

const followUpsFromBody = (value) => {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 50).map((item) => {
    const comments = clip(item?.comments ?? item?.text, 2000);
    const parsed = item?.date ? new Date(item.date) : new Date();
    const row = {
      comments,
      date: Number.isNaN(parsed.getTime()) ? new Date() : parsed,
    };
    if (item?._id) row._id = item._id;
    return row;
  }).filter((item) => item.comments);
};

const readLeadEdits = (body) => {
  const name = clip(body?.name, 200);
  const businessName = clip(body?.businessName, 200);
  const contactNumber = clip(body?.contactNumber, 40);
  const status = clip(body?.status, 40);
  if (!name || !businessName || !contactNumber) {
    const err = new Error('Name, business name, and contact number are required');
    err.status = 400;
    throw err;
  }
  if (!CLIENT_LEAD_STATUSES.includes(status)) {
    const err = new Error('Choose a valid status');
    err.status = 400;
    throw err;
  }
  const meetingType = clip(body?.meetingType, 20);
  if (meetingType && meetingType !== 'Online' && meetingType !== 'Offline') {
    const err = new Error('Choose a valid meeting type');
    err.status = 400;
    throw err;
  }
  const meetingTime = body?.meetingTime ? new Date(body.meetingTime) : null;
  return {
    name,
    businessName,
    contactNumber,
    address: clip(body?.address, 500),
    city: clip(body?.city, 120),
    state: clip(body?.state, 120),
    businessType: clip(body?.businessType, 120),
    leadSource: clip(body?.leadSource, 120),
    description: clip(body?.description, 5000),
    status,
    meetingType,
    meetingPersonName: clip(body?.meetingPersonName, 200),
    meetingTime: meetingTime && !Number.isNaN(meetingTime.getTime()) ? meetingTime : null,
    meetingInfoSent: Boolean(body?.meetingInfoSent),
    followUps: followUpsFromBody(body?.followUps),
    remark: body?.remark === undefined ? undefined : clip(body.remark, 2000),
  };
};

const applyLeadEdits = (lead, edits) => {
  lead.name = edits.name;
  lead.businessName = edits.businessName;
  lead.contactNumber = edits.contactNumber;
  lead.address = edits.address;
  lead.city = edits.city;
  lead.state = edits.state;
  lead.businessType = edits.businessType;
  lead.leadSource = edits.leadSource;
  lead.description = edits.description;
  lead.status = edits.status;
  lead.meetingType = edits.meetingType || undefined;
  lead.meetingPersonName = edits.meetingPersonName;
  lead.meetingTime = edits.meetingTime || undefined;
  lead.meetingInfoSent = edits.meetingInfoSent;
  lead.followUps = edits.followUps;
  if (edits.remark !== undefined) lead.clientPortalNote = edits.remark;
};

export const saveMyClientLead = async (req, res) => {
  try {
    const portal = await loadPortalFromAuth(req);
    const source = req.params.source === 'sheet' ? 'sheet' : req.params.source === 'crm' ? 'crm' : '';
    const recordId = String(req.params.recordId || '').trim();
    if (!source || !recordId) return res.status(400).json({ message: 'Lead is required' });
    const edits = readLeadEdits(req.body);

    if (source === 'crm') {
      const lead = await Lead.findById(recordId);
      if (!lead || !matchesCampaign(lead, portal.campaigns)) {
        return res.status(404).json({ message: 'Lead not found for this dashboard' });
      }
      applyLeadEdits(lead, edits);
      await lead.save();
      await SheetLead.updateMany(
        { crmLead: lead._id },
        {
          $set: {
            fullName: lead.name,
            phone: lead.contactNumber,
            clientStatus: lead.status,
            clientRemark: lead.clientPortalNote || '',
          },
        }
      );
      return res.status(200).json({ message: 'Lead updated' });
    }

    const row = await SheetLead.findById(recordId);
    if (!row || !matchesCampaign(row, portal.campaigns)) {
      return res.status(404).json({ message: 'Lead not found for this dashboard' });
    }
    row.fullName = edits.name;
    row.phone = edits.contactNumber;
    row.clientStatus = edits.status;
    if (edits.remark !== undefined) row.clientRemark = edits.remark;
    row.clientProfile = {
      name: edits.name,
      businessName: edits.businessName,
      contactNumber: edits.contactNumber,
      address: edits.address,
      city: edits.city,
      state: edits.state,
      businessType: edits.businessType,
      leadSource: edits.leadSource,
      description: edits.description,
      meetingType: edits.meetingType,
      meetingPersonName: edits.meetingPersonName,
      meetingTime: edits.meetingTime,
      meetingInfoSent: edits.meetingInfoSent,
      followUps: edits.followUps,
    };
    row.markModified('clientProfile');
    await row.save();

    if (row.crmLead) {
      const lead = await Lead.findById(row.crmLead);
      if (lead && matchesCampaign(lead, portal.campaigns)) {
        applyLeadEdits(lead, edits);
        await lead.save();
      }
    }
    return res.status(200).json({ message: 'Lead updated' });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error updating lead' });
  }
};

export const updateMyClientLead = async (req, res) => {
  try {
    const portal = await loadPortalFromAuth(req);
    const source = req.body?.source === 'sheet' ? 'sheet' : req.body?.source === 'crm' ? 'crm' : '';
    const recordId = String(req.body?.recordId || '').trim();
    const status = String(req.body?.status || '').trim();
    const remark = req.body?.remark === undefined ? undefined : String(req.body.remark || '').trim();

    if (!source || !recordId) return res.status(400).json({ message: 'Lead is required' });
    if (!CLIENT_LEAD_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Choose a valid status' });
    }

    if (source === 'crm') {
      const lead = await Lead.findById(recordId);
      if (!lead || !matchesCampaign(lead, portal.campaigns)) {
        return res.status(404).json({ message: 'Lead not found for this dashboard' });
      }
      lead.status = status;
      if (remark !== undefined) lead.clientPortalNote = remark;
      await lead.save();
      if (remark !== undefined) {
        await SheetLead.updateMany({ crmLead: lead._id }, { clientStatus: status, clientRemark: remark });
      } else {
        await SheetLead.updateMany({ crmLead: lead._id }, { clientStatus: status });
      }
      return res.status(200).json({ message: 'Status updated', status, remark: lead.clientPortalNote || '' });
    }

    const row = await SheetLead.findById(recordId);
    if (!row || !matchesCampaign(row, portal.campaigns)) {
      return res.status(404).json({ message: 'Lead not found for this dashboard' });
    }
    row.clientStatus = status;
    if (remark !== undefined) row.clientRemark = remark;
    await row.save();
    if (row.crmLead) {
      const lead = await Lead.findById(row.crmLead);
      if (lead) {
        lead.status = status;
        if (remark !== undefined) lead.clientPortalNote = remark;
        await lead.save();
      }
    }
    res.status(200).json({ message: 'Status updated', status, remark: row.clientRemark || '' });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error updating lead' });
  }
};
