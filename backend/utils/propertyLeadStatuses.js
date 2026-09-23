/** Lead pipeline statuses for bangar / maha (unchanged). */
export const PROPERTY_LEAD_STATUSES = [
  'Call not Received',
  'Call You After Sometime',
  'Interested',
  'Not Interested',
  'Meeting Schedule',
  'Site Visit',
  'Meeting Revisit',
  'Booking Token',
  'Incentive Earned',
  'Pending',
];

/**
 * Sales Tech Reality (STR) lead statuses.
 * Legacy values kept in LEGACY for existing documents / enum validation.
 */
export const STR_LEAD_STATUSES = [
  'Call not Received',
  'Call You After Sometime',
  'Interested',
  'Not Interested',
  'Meeting Schedule',
  'Site Visit',
  'Zoom Meeting',
  'Booking Done',
  'Token Done',
  'Pending',
];

/** Old STR values still accepted by mongoose so existing leads can be saved. */
export const STR_LEAD_STATUSES_LEGACY = [
  'Meeting Revisit',
  'Booking Token',
  'Incentive Earned',
];

export const STR_LEAD_STATUS_ENUM = [...STR_LEAD_STATUSES, ...STR_LEAD_STATUSES_LEGACY];

export const PROPERTY_LEAD_STATUS_DEFAULT = 'Call not Received';

export const leadStatusesForTenant = (tenantId) => {
  if (tenantId === 'salesTechReality') return STR_LEAD_STATUSES;
  if (tenantId === 'gamotechSolution') {
    return [
      'Call not Received',
      'Call You After Sometime',
      'Interested',
      'Not Interested',
      'Meeting Schedule',
    ];
  }
  return PROPERTY_LEAD_STATUSES;
};
