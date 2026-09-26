import Lead from '../../models/gamotechSolution/gamotechSolution_lead.js';
import SheetLead from '../../models/gamotechSolution/gamotechSolution_sheetLead.js';
import {
  fetchCampaignsByIds,
  getConfiguredAdAccountIds,
  getMetaAccessToken,
  listAdAccounts,
  listCampaignsForAdAccounts,
  normalizeAdAccountId,
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
    if (c.__error) continue;
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
      adAccountId: c.adAccountId || '',
      adAccountName: c.adAccountName || '',
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
      adAccountId: '',
      adAccountName: '',
      source: 'crm_leads_only',
      ...stats,
    });
  }

  return Array.from(byId.values()).sort(
    (a, b) => b.leadCount - a.leadCount || a.adAccountName.localeCompare(b.adAccountName) || a.name.localeCompare(b.name)
  );
};

const toAdAccountOption = (account) => {
  const id = normalizeAdAccountId(account.account_id || account.id);
  return {
    id,
    name: account.name || id,
    accountStatus: account.account_status ?? null,
  };
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
    const queryAccount = req.query.adAccount
      ? normalizeAdAccountId(String(req.query.adAccount))
      : '';

    let adAccountOptions = [];
    let graphCampaigns = [];
    let fetchMode = 'all_accessible_ad_accounts';
    const accountErrors = [];

    try {
      const configuredIds = getConfiguredAdAccountIds();
      let allAccessibleAccounts = [];

      if (configuredIds?.length) {
        allAccessibleAccounts = configuredIds.map((id) => ({ account_id: id, name: id }));
        fetchMode = 'env_ad_account_list';
      } else {
        allAccessibleAccounts = await listAdAccounts(accessToken);
        fetchMode = 'all_accessible_ad_accounts';
      }

      adAccountOptions = allAccessibleAccounts.map(toAdAccountOption);

      let accounts = allAccessibleAccounts;
      if (queryAccount) {
        fetchMode = 'query_single_ad_account';
        const match = allAccessibleAccounts.find(
          (a) => normalizeAdAccountId(a.account_id || a.id) === queryAccount
        );
        accounts = [match || { account_id: queryAccount, name: queryAccount }];
      }

      if (!accounts.length) {
        fetchMode = 'campaign_ids_from_leads';
        graphCampaigns = await fetchCampaignsByIds([...leadStats.keys()], accessToken);
      } else {
        const raw = await listCampaignsForAdAccounts(accounts, accessToken, 8);
        for (const row of raw) {
          if (row.__error) {
            accountErrors.push({
              adAccountId: row.adAccountId,
              adAccountName: row.adAccountName,
              message: row.message,
            });
            continue;
          }
          graphCampaigns.push(row);
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
      adAccounts: adAccountOptions,
      meta: {
        fetchMode,
        adAccountCount: adAccountOptions.length,
        graphCampaignCount: graphCampaigns.length,
        crmCampaignIds: leadStats.size,
        accountErrors,
        hint:
          'Leave META_AD_ACCOUNT_ID empty to load every ad account this token can access. Use META_AD_ACCOUNT_IDS only if /me/adaccounts fails.',
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
