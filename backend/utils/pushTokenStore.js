import CentralAdminUser from '../models/centralAdmin/centralAdmin_user.js';
import { PREFERENCE_KEYS } from './notificationConstants.js';
import logger from './logger.js';

/**
 * Register or refresh a device token on the user document.
 * Deduplicates tokens and updates lastSeen.
 * @param {string} userId
 * @param {string} deviceToken
 * @param {string} platform
 */
export async function registerUserDeviceToken(userId, deviceToken, platform) {
  const user = await CentralAdminUser.findById(userId);
  if (!user) return null;

  const now = new Date();
  const normalizedToken = String(deviceToken || '').trim();
  const notifications = dedupeTokenEntries(user.notifications || []);

  const existingIndex = notifications.findIndex((entry) => entry.token === normalizedToken);
  if (existingIndex >= 0) {
    notifications[existingIndex] = {
      ...notifications[existingIndex],
      platform,
      lastSeen: now,
    };
  } else {
    notifications.push({ token: normalizedToken, platform, lastSeen: now });
  }

  user.notifications = notifications;
  await user.save();

  // Remove orphan ownership — same token on another user.
  await CentralAdminUser.updateMany(
    { _id: { $ne: user._id }, 'notifications.token': normalizedToken },
    { $pull: { notifications: { token: normalizedToken } } },
  );

  return user;
}

/** Remove duplicate token entries within a user's array. */
export function dedupeTokenEntries(entries = []) {
  const map = new Map();
  for (const entry of entries) {
    const token = String(entry?.token || '').trim();
    if (!token) continue;
    const existing = map.get(token);
    if (!existing || new Date(entry.lastSeen) > new Date(existing.lastSeen)) {
      map.set(token, {
        token,
        platform: entry.platform || 'unknown',
        lastSeen: entry.lastSeen || new Date(),
      });
    }
  }
  return [...map.values()];
}

/**
 * Collect unique FCM tokens for user ids, respecting notification preferences.
 * @param {string[]} userIds
 * @param {string} [notificationType]
 */
export async function collectTokensForUserIds(userIds = [], notificationType = null) {
  const uniqueIds = [...new Set(userIds.map(String).filter(Boolean))];
  if (!uniqueIds.length) {
    return { tokens: [], tokenOwnerMap: new Map(), userIds: [] };
  }

  const users = await CentralAdminUser.find({ _id: { $in: uniqueIds } })
    .select('notifications notificationPreferences')
    .lean();

  const tokenOwnerMap = new Map();
  const tokenSet = new Set();
  const eligibleUserIds = [];

  for (const user of users) {
    if (notificationType && !isPreferenceEnabled(user.notificationPreferences, notificationType)) {
      continue;
    }

    const userId = String(user._id);
    eligibleUserIds.push(userId);

    for (const entry of dedupeTokenEntries(user.notifications || [])) {
      tokenSet.add(entry.token);
      tokenOwnerMap.set(entry.token, userId);
    }
  }

  return {
    tokens: [...tokenSet],
    tokenOwnerMap,
    userIds: eligibleUserIds,
  };
}

/** @param {object} preferences */
export function isPreferenceEnabled(preferences, notificationType) {
  const key = PREFERENCE_KEYS[notificationType];
  if (!key) return true;
  if (!preferences) return true;
  return preferences[key] !== false;
}

/** Remove invalid FCM tokens from user documents. */
export async function removeInvalidTokens(invalidTokens = [], tokenOwnerMap = new Map()) {
  if (!invalidTokens.length) return;

  const byUser = new Map();
  for (const token of invalidTokens) {
    const userId = tokenOwnerMap.get(token);
    if (!userId) continue;
    if (!byUser.has(userId)) byUser.set(userId, []);
    byUser.get(userId).push(token);
  }

  await Promise.all(
    [...byUser.entries()].map(async ([userId, tokens]) => {
      await CentralAdminUser.updateOne(
        { _id: userId },
        { $pull: { notifications: { token: { $in: tokens } } } },
      );
      logger.tokenRemoved({ userId, count: tokens.length });
    }),
  );
}

/** Remove empty or whitespace tokens from all users (maintenance). */
export async function cleanupOrphanTokens() {
  const users = await CentralAdminUser.find({ 'notifications.0': { $exists: true } })
    .select('notifications')
    .lean();

  await Promise.all(
    users.map(async (user) => {
      const cleaned = dedupeTokenEntries(user.notifications || []).filter((e) => e.token);
      if (cleaned.length !== (user.notifications || []).length) {
        await CentralAdminUser.updateOne({ _id: user._id }, { $set: { notifications: cleaned } });
      }
    }),
  );
}
