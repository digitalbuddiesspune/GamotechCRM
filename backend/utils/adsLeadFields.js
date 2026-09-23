/** Extra fields stored on leads created from Meta / Google Ads webhooks. */
export const adsLeadSchemaFields = {
  email: { type: String, default: '' },
  externalLeadId: { type: String, default: '', index: true },
  adPlatform: {
    type: String,
    enum: ['', 'meta', 'google', 'other'],
    default: '',
  },
  campaignId: { type: String, default: '' },
  adId: { type: String, default: '' },
  formId: { type: String, default: '' },
  adsRawPayload: { type: Object, default: undefined },
};
