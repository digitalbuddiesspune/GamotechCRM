/**
 * System notification push template.
 */
export function systemNotificationTemplate({ title, body, extraData = {} }) {
  const safeTitle = String(title || '').trim() || 'Meeting App';
  const safeBody =
    String(body || '').trim() ||
    'You have a new update. Open the app for details.';

  return {
    title: safeTitle,
    body: safeBody,
    data: {
      type: 'system',
      screen: 'notifications',
      meetingId: String(extraData.meetingId || ''),
      companyId: String(extraData.companyId || ''),
      priority: String(extraData.priority || 'normal'),
      action: String(extraData.action || 'open_notifications'),
      notificationKind: 'system',
      ...extraData,
    },
    image: String(extraData.image || ''),
    priority: String(extraData.priority || 'normal'),
  };
}
