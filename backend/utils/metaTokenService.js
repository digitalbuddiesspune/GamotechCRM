import Company from '../models/gamotechSolution/gamotechSolution_company.js';

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

const tokenFromEnv = () =>
  pick(process.env.GAMOTECH_META_PAGE_ACCESS_TOKEN, process.env.META_PAGE_ACCESS_TOKEN);

/** CRM DB token first, then .env (single-tenant company record). */
export async function resolveMetaAccessToken() {
  const company = await Company.findOne()
    .select('+metaPageAccessToken metaTokenExpiresAt')
    .sort({ createdAt: 1 })
    .lean();

  const dbToken = pick(company?.metaPageAccessToken);
  if (dbToken) return dbToken;
  return tokenFromEnv();
}

export async function getMetaTokenStorageInfo() {
  const company = await Company.findOne()
    .select('+metaPageAccessToken metaTokenExpiresAt metaTokenUpdatedAt metaTokenNote')
    .sort({ createdAt: 1 })
    .lean();

  const dbToken = pick(company?.metaPageAccessToken);
  const envToken = tokenFromEnv();
  const activeToken = dbToken || envToken;

  return {
    source: dbToken ? 'crm_database' : envToken ? 'env_file' : 'none',
    hasToken: Boolean(activeToken),
    tokenPreview: activeToken ? `${activeToken.slice(0, 8)}…${activeToken.slice(-4)}` : '',
    expiresAt: company?.metaTokenExpiresAt || null,
    updatedAt: company?.metaTokenUpdatedAt || null,
    note: company?.metaTokenNote || '',
  };
}

export async function saveMetaAccessToken({ accessToken, expiresAt = null, note = '' }) {
  const token = pick(accessToken);
  if (!token) {
    const err = new Error('accessToken is required');
    err.status = 400;
    throw err;
  }

  let company = await Company.findOne().sort({ createdAt: 1 });
  if (!company) {
    company = new Company({ companyName: 'Gamotech Solutions' });
  }

  company.metaPageAccessToken = token;
  company.metaTokenExpiresAt = expiresAt ? new Date(expiresAt) : null;
  company.metaTokenUpdatedAt = new Date();
  company.metaTokenNote = pick(note);
  await company.save();

  return getMetaTokenStorageInfo();
}

/** Validate token and read expiry when META_APP_ID + META_APP_SECRET are set. */
export async function inspectMetaAccessToken(accessToken) {
  const token = pick(accessToken);
  if (!token) {
    return { valid: false, message: 'No token configured' };
  }

  const appId = pick(process.env.META_APP_ID, process.env.GAMOTECH_META_APP_ID);
  const appSecret = pick(process.env.META_APP_SECRET, process.env.GAMOTECH_META_APP_SECRET);

  if (appId && appSecret) {
    const url = new URL(`${GRAPH_BASE}/debug_token`);
    url.searchParams.set('input_token', token);
    url.searchParams.set('access_token', `${appId}|${appSecret}`);

    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    const info = data?.data;
    if (!response.ok || !info) {
      return {
        valid: false,
        message: data?.error?.message || 'Failed to inspect token',
        details: data?.error,
      };
    }

    const expiresAt = info.expires_at ? new Date(info.expires_at * 1000).toISOString() : null;
    return {
      valid: Boolean(info.is_valid),
      expiresAt,
      type: info.type || '',
      scopes: info.scopes || [],
      appId: info.app_id || '',
      userId: info.user_id || '',
      message: info.is_valid ? 'Token is valid' : 'Token is invalid',
    };
  }

  try {
    const meUrl = new URL(`${GRAPH_BASE}/me`);
    meUrl.searchParams.set('access_token', token);
    meUrl.searchParams.set('fields', 'id,name');
    const response = await fetch(meUrl);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        valid: false,
        message: data?.error?.message || 'Token validation failed',
        details: data?.error,
      };
    }
    return {
      valid: true,
      expiresAt: null,
      message: 'Token works. Set META_APP_ID and META_APP_SECRET to show expiry date in CRM.',
      metaUser: data,
    };
  } catch (error) {
    return { valid: false, message: error?.message || 'Token validation failed' };
  }
}
