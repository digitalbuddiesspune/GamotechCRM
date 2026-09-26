import Lead from '../../models/gamotechSolution/gamotechSolution_lead.js';
import SheetLead from '../../models/gamotechSolution/gamotechSolution_sheetLead.js';
import {
  fetchCampaignsByIds,
  getMetaAccessToken,
  getMetaAdAccountId,
  listAdAccounts,
  listCampaignsForAdAccount,
} from '../../utils/metaGraphApi.js';

const buildLeadStatsByCampaignId = async () => {
  const stats = new Map();

  const bump = (campaignId, status) => {
    const id = String(campaignId || '').trim();
    if (!id) return;
    if (!stats.has(id)) {
      stats.set(id, { campaignId: id, leadCount: 0, interested: 0, meetings: 0, crmLeads: 0, sheetLeads: 0 });
    }
    const row = stats.get(id);
    row.leadCount += 1;
    if (status === 'Interested') row.interested += 1;
    if (status === 'Meeting Schedule') row.meetings += 1;
  };

  const crmLeads = await Lead.find({ campaignId: { $exists: true, $ne: '' } })
    .select('campaignId status')
    .lean();
  for (const lead of crmLeads) {
    bump(lead.campaignId, lead.status);
    stats.get(String(lead.campaignId)).crmLeads += 1;
  }

  const sheetLeads = await SheetLead.find({ campaignId: { $exists: true, $ne: '' } })
    .select('campaignId')
    .lean();
  for (const row of sheetLeads) {
    const id = String(row.campaignId).trim();
    if (!stats.has(id)) {
      stats.set(id, { campaignId: id, leadCount: 0, interested: 0, meetings: 0, crmLeads: 0, sheetLeads: 0 });
    }
    stats.get(id).sheetLeads += 1;
    stats.get(id).leadCount += 1;
  }

  return stats;
};

const mergeCampaignRows = (graphCampaigns, leadStats) => {
  const byId = new Map();

  for (const c of graphCampaigns) {
    const id = String(c.id);
    const stats = leadStats.get(id) || {
      campaignId: id,
      leadCount: 0,
      interested: 0,
      meetings: 0,
      crmLeads: 0,
      sheetLeads: 0,
    };
    byId.set(id, {
      id,
      name: c.name || `Campaign ${id}`,
      status: c.effective_status || c.status || 'UNKNOWN',
      objective: c.objective || '',
      createdTime: c.created_time || null,
      updatedTime: c.updated_time || null,
      dailyBudget: c.daily_budget ?? null,
      lifetimeBudget: c.lifetime_budget ?? null,
      source: 'meta_graph',
      ...stats,
    });
  }

  for (const [id, stats] of leadStats.entries()) {
    if (byId.has(id)) continue;
    byId.set(id, {
      id,
      name: `Campaign ${id}`,
      status: 'FROM_CRM_ONLY',
      objective: '',
      createdTime: null,
      updatedTime: null,
      dailyBudget: null,
      lifetimeBudget: null,
      source: 'crm_leads_only',
      ...stats,
    });
  }

  return Array.from(byId.values()).sort((a, b) => b.leadCount - a.leadCount || a.name.localeCompare(b.name));
};

export const getMetaCampaigns = async (req, res) => {
  try {
    const accessToken = getMetaAccessToken();
    if (!accessToken) {
      return res.status(503).json({
        message:
          'Meta access token missing. Set META_PAGE_ACCESS_TOKEN or GAMOTECH_META_PAGE_ACCESS_TOKEN in backend .env',
      });
    }

    const leadStats = await buildLeadStatsByCampaignId();
    let graphCampaigns = [];
    let adAccountsUsed = [];
    let fetchMode = 'ad_account';

    try {
      const explicitAccount = getMetaAdAccountId();
      if (explicitAccount) {
        adAccountsUsed = [explicitAccount];
        graphCampaigns = await listCampaignsForAdAccount(explicitAccount, accessToken);
      } else {
        const accounts = await listAdAccounts(accessToken);
        adAccountsUsed = accounts.map((a) => a.account_id || a.id).filter(Boolean);
        if (!accounts.length) {
          fetchMode = 'campaign_ids_from_leads';
          graphCampaigns = await fetchCampaignsByIds([...leadStats.keys()], accessToken);
        } else {
          for (const account of accounts) {
            const accountId = account.account_id || account.id;
            const rows = await listCampaignsForAdAccount(accountId, accessToken);
            graphCampaigns.push(...rows);
          }
        }
      }
    } catch (graphError) {
      fetchMode = 'campaign_ids_from_leads';
      graphCampaigns = await fetchCampaignsByIds([...leadStats.keys()], accessToken);
      if (!graphCampaigns.length && !leadStats.size) {
        throw graphError;
      }
    }

    const campaigns = mergeCampaignRows(graphCampaigns, leadStats);

    return res.status(200).json({
      campaigns,
      meta: {
        fetchMode,
        adAccountsUsed,
        graphCampaignCount: graphCampaigns.length,
        crmCampaignIds: leadStats.size,
      },
    });
  } catch (error) {
    console.error('[gamotechSolution] Meta campaigns error:', error?.message || error);
    return res.status(error.status || 500).json({
      message: error.message || 'Failed to load Meta campaigns',
      details: error.details,
    });
  }
};
