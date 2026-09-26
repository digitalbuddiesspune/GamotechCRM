const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

const pick = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const s = String(value).trim();
    if (s) return s;
  }
  return '';
};

export const getMetaAccessToken = () =>
  pick(process.env.GAMOTECH_META_PAGE_ACCESS_TOKEN, process.env.META_PAGE_ACCESS_TOKEN);

export const normalizeAdAccountId = (id) => {
  const raw = String(id || '').trim();
  if (!raw) return '';
  return raw.startsWith('act_') ? raw : `act_${raw}`;
};

/** Single ad account override (optional). Prefer leaving empty to load all accessible accounts. */
export const getMetaAdAccountId = () =>
  pick(process.env.GAMOTECH_META_AD_ACCOUNT_ID, process.env.META_AD_ACCOUNT_ID);

/**
 * Optional comma/space-separated act IDs when /me/adaccounts is unavailable.
 * Example: act_111,act_222,act_333
 */
export const getConfiguredAdAccountIds = () => {
  const list = pick(process.env.GAMOTECH_META_AD_ACCOUNT_IDS, process.env.META_AD_ACCOUNT_IDS);
  if (list) {
    return list
      .split(/[\s,]+/)
      .map((id) => normalizeAdAccountId(id))
      .filter(Boolean);
  }
  const single = getMetaAdAccountId();
  return single ? [normalizeAdAccountId(single)] : null;
};

/** @param {string} path - e.g. "me/adaccounts" or "act_123/campaigns" */
export async function graphGet(path, accessToken, query = {}) {
  const suffix = String(path || '').replace(/^\//, '');
  const url = new URL(suffix ? `${GRAPH_BASE}/${suffix}` : `${GRAPH_BASE}/`);
  url.searchParams.set('access_token', accessToken);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `Meta Graph API error (${response.status})`;
    const err = new Error(message);
    err.status = response.status;
    err.details = data?.error || data;
    throw err;
  }
  return data;
}

/** Follow Graph API paging.next links. */
export async function graphGetAllPages(firstUrl) {
  const items = [];
  let nextUrl = firstUrl;
  while (nextUrl) {
    const response = await fetch(nextUrl);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || `Meta Graph API error (${response.status})`;
      const err = new Error(message);
      err.status = response.status;
      err.details = data?.error || data;
      throw err;
    }
    items.push(...(Array.isArray(data.data) ? data.data : []));
    nextUrl = data.paging?.next || null;
  }
  return items;
}

export async function listAdAccounts(accessToken) {
  const url = new URL(`${GRAPH_BASE}/me/adaccounts`);
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('fields', 'id,name,account_id,account_status');
  url.searchParams.set('limit', '50');
  return graphGetAllPages(url.toString());
}

export async function listCampaignsForAdAccount(adAccountId, accessToken) {
  const actId = normalizeAdAccountId(adAccountId);
  const url = new URL(`${GRAPH_BASE}/${actId}/campaigns`);
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set(
    'fields',
    'id,name,status,effective_status,objective,created_time,updated_time,daily_budget,lifetime_budget'
  );
  url.searchParams.set('limit', '100');
  return graphGetAllPages(url.toString());
}

/** Resolve campaign metadata when only IDs are known (from webhook leads). */
/** Fetch campaigns for many ad accounts (parallel workers). */
export async function listCampaignsForAdAccounts(accounts, accessToken, concurrency = 6) {
  const list = Array.isArray(accounts) ? [...accounts] : [];
  const results = [];
  let index = 0;

  const worker = async () => {
    while (index < list.length) {
      const current = list[index];
      index += 1;
      const accountId = current.account_id || current.id;
      const actId = normalizeAdAccountId(accountId);
      if (!actId) continue;
      try {
        const rows = await listCampaignsForAdAccount(actId, accessToken);
        for (const row of rows) {
          results.push({
            ...row,
            adAccountId: actId,
            adAccountName: current.name || actId,
          });
        }
      } catch (err) {
        results.push({
          __error: true,
          adAccountId: actId,
          adAccountName: current.name || actId,
          message: err?.message || 'Failed to load campaigns',
        });
      }
    }
  };

  const workers = Math.min(Math.max(1, concurrency), 10);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

export async function fetchCampaignsByIds(campaignIds, accessToken) {
  const ids = [...new Set(campaignIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) return [];

  const results = [];
  const chunkSize = 50;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const data = await graphGet('', accessToken, {
      ids: chunk.join(','),
      fields: 'id,name,status,effective_status,objective,created_time,updated_time',
    });
    for (const value of Object.values(data)) {
      if (value && typeof value === 'object' && value.id) results.push(value);
    }
  }
  return results;
}
