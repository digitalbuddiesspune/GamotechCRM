/**
 * FCM topic naming conventions.
 * @module utils/notificationTopics
 */

export const TOPIC_PREFIX = {
  company: 'company_',
  manager: 'manager',
  employee: 'employee',
  department: 'department_',
  meeting: 'meeting_',
};

/** @param {string} companyId */
export function companyTopic(companyId) {
  return `${TOPIC_PREFIX.company}${String(companyId).trim()}`;
}

/** @param {string} departmentId */
export function departmentTopic(departmentId) {
  return `${TOPIC_PREFIX.department}${String(departmentId).trim()}`;
}

/** @param {string} meetingId */
export function meetingTopic(meetingId) {
  return `${TOPIC_PREFIX.meeting}${String(meetingId).trim()}`;
}

export const STATIC_TOPICS = {
  manager: TOPIC_PREFIX.manager,
  employee: TOPIC_PREFIX.employee,
};
