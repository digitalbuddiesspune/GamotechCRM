const parseCampaignFromDescription = (description = '') => {
  const match = String(description).match(/Campaign:\s*(.+)/i)
  return match ? match[1].split('\n')[0].trim() : ''
}

export const getLeadCampaignMeta = (lead) => {
  const name = (lead.campaignName || parseCampaignFromDescription(lead.description) || '').trim()
  const id = String(lead.campaignId || '').trim()
  const platform = String(lead.adPlatform || '').trim()

  if (name) {
    return {
      groupKey: id ? `${id}::${name}` : `name::${name}`,
      label: name,
      sublabel: id ? `ID: ${id}` : platform ? platform.toUpperCase() : '',
      campaignId: id,
      platform,
    }
  }
  if (id) {
    return {
      groupKey: id,
      label: `Campaign ${id}`,
      sublabel: platform ? platform.toUpperCase() : 'Ads',
      campaignId: id,
      platform,
    }
  }
  if (platform === 'meta' || String(lead.leadSource || '').toLowerCase().includes('meta')) {
    return {
      groupKey: '__meta_unknown__',
      label: 'Meta Ads (no campaign)',
      sublabel: '',
      campaignId: '',
      platform: 'meta',
    }
  }
  if (platform === 'google') {
    return {
      groupKey: '__google_unknown__',
      label: 'Google Ads (no campaign)',
      sublabel: '',
      campaignId: '',
      platform: 'google',
    }
  }
  return {
    groupKey: '__other__',
    label: 'Other / manual leads',
    sublabel: '',
    campaignId: '',
    platform: '',
  }
}

/** Map imported sheet row → lead-like shape for campaign grouping. */
export const mapSheetLeadForCampaigns = (sheet) => ({
  _id: sheet._id,
  campaignName: sheet.campaignName,
  campaignId: sheet.campaignId,
  adPlatform: 'meta',
  leadSource: sheet.platform ? `Meta Ads (${sheet.platform})` : 'Google Sheet Import',
  description: sheet.campaignName ? `Campaign: ${sheet.campaignName}` : '',
  status: 'Call not Received',
  createdAt: sheet.createdTime || sheet.importedAt,
  updatedAt: sheet.importedAt,
})

/** Avoid double-counting sheet rows already linked to a CRM lead. */
export const mergeLeadsForCampaigns = (crmLeads = [], sheetLeads = []) => {
  const crmIds = new Set(crmLeads.map((l) => String(l._id)))
  const fromSheet = sheetLeads
    .filter((s) => {
      const linked = s.crmLead?._id || s.crmLead
      return !linked || !crmIds.has(String(linked))
    })
    .map(mapSheetLeadForCampaigns)
  return [...crmLeads, ...fromSheet]
}

export const buildCampaignSummaries = (leads = []) => {
  const map = new Map()

  for (const lead of leads) {
    const meta = getLeadCampaignMeta(lead)
    if (!map.has(meta.groupKey)) {
      map.set(meta.groupKey, {
        groupKey: meta.groupKey,
        name: meta.label,
        sublabel: meta.sublabel,
        campaignId: meta.campaignId,
        platform: meta.platform,
        leadCount: 0,
        interested: 0,
        meetings: 0,
        notInterested: 0,
        latestAt: null,
        leads: [],
      })
    }
    const row = map.get(meta.groupKey)
    row.leadCount += 1
    row.leads.push(lead)
    if (lead.status === 'Interested') row.interested += 1
    if (lead.status === 'Meeting Schedule') row.meetings += 1
    if (lead.status === 'Not Interested') row.notInterested += 1
    const at = new Date(lead.updatedAt || lead.createdAt).getTime()
    if (!Number.isNaN(at) && (row.latestAt == null || at > row.latestAt)) {
      row.latestAt = at
    }
  }

  return Array.from(map.values()).sort((a, b) => b.leadCount - a.leadCount)
}
