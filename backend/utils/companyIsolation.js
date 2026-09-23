/**
 * Company isolation — prevent cross-company notification delivery.
 * @module utils/companyIsolation
 */
import CentralAdminUser, { CENTRAL_TENANTS } from '../models/centralAdmin/centralAdmin_user.js';
import { ValidationError } from './errors.js';

/**
 * Validate that a meeting's companyId is allowed for all target user ids.
 * Empty companyId is allowed (platform-level meetings).
 * @param {string} companyId
 * @param {string[]} userIds
 */
export async function assertCompanyAccessForUsers(companyId, userIds = []) {
  const normalizedCompany = String(companyId || '').trim();
  if (!normalizedCompany) return true;

  if (!CENTRAL_TENANTS.includes(normalizedCompany)) {
    throw new ValidationError(`Invalid companyId: ${normalizedCompany}`);
  }

  const users = await CentralAdminUser.find({ _id: { $in: userIds } })
    .select('tenants role isRoot')
    .lean();

  for (const user of users) {
    if (user.isRoot) continue;
    const tenants = user.tenants || [];
    if (!tenants.includes(normalizedCompany)) {
      throw new ValidationError(
        `User ${user._id} is not authorized for company ${normalizedCompany}`,
      );
    }
  }

  return true;
}

/**
 * Filter user ids to those with access to the given company.
 * @param {string} companyId
 * @param {string[]} userIds
 */
export async function filterUsersByCompanyAccess(companyId, userIds = []) {
  const normalizedCompany = String(companyId || '').trim();
  if (!normalizedCompany) return userIds;

  const users = await CentralAdminUser.find({ _id: { $in: userIds } })
    .select('tenants isRoot')
    .lean();

  const allowed = new Set(
    users
      .filter((u) => u.isRoot || (u.tenants || []).includes(normalizedCompany))
      .map((u) => String(u._id)),
  );

  return userIds.filter((id) => allowed.has(String(id)));
}

/**
 * Sanitize notification text fields — strip control chars, limit length.
 * @param {string} value
 * @param {number} maxLen
 */
export function sanitizeNotificationText(value, maxLen = 1000) {
  return String(value || '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLen);
}
