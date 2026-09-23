/**
 * Per-tenant chat integration settings.
 */
export const CHAT_INTEGRATIONS = {
  gamotechSolution: {
    tenantId: 'gamotechSolution',
    displayName: 'Gamotech Solution',
    features: {
      directMessages: true,
      groupChat: false,
      fileSharing: false,
      botEnabled: false,
    },
    bot: {
      name: 'Gamotech Assistant',
      welcomeMessage: 'Welcome to Gamotech Solution team chat.',
      webhookUrl: process.env.GAMOTECH_CHAT_WEBHOOK_URL || '',
    },
    pollingIntervalMs: 5000,
  },
};

export const getChatIntegration = (tenantId) =>
  CHAT_INTEGRATIONS[tenantId] || {
    tenantId,
    displayName: tenantId,
    features: { directMessages: true, groupChat: false, fileSharing: false, botEnabled: false },
    bot: { name: 'Assistant', welcomeMessage: 'Welcome to team chat.', webhookUrl: '' },
    pollingIntervalMs: 5000,
  };
