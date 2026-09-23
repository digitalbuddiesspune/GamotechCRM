/**
 * OpenAPI paths for global push notification APIs (`/api/*`).
 * @module docs/openapi/paths/notificationPaths
 */

function ref(name) {
  return { $ref: `#/components/responses/${name}` };
}

function sec() {
  return [{ BearerAuth: [] }];
}

function adminSec() {
  return [{ BearerAuth: [] }];
}

const listParams = [
  { $ref: '#/components/parameters/Page' },
  { $ref: '#/components/parameters/Limit' },
  { $ref: '#/components/parameters/Sort' },
  { $ref: '#/components/parameters/Search' },
  { name: 'type', in: 'query', schema: { type: 'string' }, description: 'Filter by notification type' },
  { name: 'read', in: 'query', schema: { type: 'string', enum: ['true', 'false'] }, description: 'Filter by read status' },
];

/** @returns {Record<string, object>} */
export function buildNotificationPaths() {
  return {
    '/api/device/register': {
      post: {
        tags: ['Push Notifications'],
        summary: 'Register FCM device token',
        description: 'Register or refresh a push notification device token for the authenticated user.',
        security: sec(),
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/DeviceRegisterRequest' } } },
        },
        responses: {
          200: { description: 'Device registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/DeviceRegisterResponse' } } } },
          400: ref('ValidationError'),
          401: ref('Unauthorized'),
          404: { description: 'User not found' },
          429: ref('RateLimitExceeded'),
          500: ref('ServerError'),
        },
      },
    },

    '/api/notifications': {
      get: {
        tags: ['Push Notifications'],
        summary: 'List push notification history',
        description: 'Paginated list of FCM push notifications for the authenticated user. Expired notifications are excluded.',
        security: sec(),
        parameters: listParams,
        responses: {
          200: {
            description: 'Paginated notifications',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    items: { type: 'array', items: { $ref: '#/components/schemas/PushNotification' } },
                    pagination: { $ref: '#/components/schemas/PaginationMeta' },
                  },
                },
              },
            },
          },
          400: ref('ValidationError'),
          401: ref('Unauthorized'),
          429: ref('RateLimitExceeded'),
        },
      },
    },

    '/api/notifications/unread-count': {
      get: {
        tags: ['Push Notifications'],
        summary: 'Get unread push notification count',
        security: sec(),
        responses: {
          200: {
            description: 'Unread count',
            content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, count: { type: 'integer' } } } } },
          },
          401: ref('Unauthorized'),
        },
      },
    },

    '/api/notifications/analytics': {
      get: {
        tags: ['Push Notifications'],
        summary: 'Notification delivery analytics',
        security: sec(),
        parameters: [
          { name: 'period', in: 'query', schema: { type: 'string', enum: ['daily', 'weekly', 'monthly'], default: 'daily' } },
        ],
        responses: {
          200: { description: 'Analytics summary', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
          400: ref('ValidationError'),
          401: ref('Unauthorized'),
        },
      },
    },

    '/api/notifications/read-all': {
      patch: {
        tags: ['Push Notifications'],
        summary: 'Mark all notifications as read',
        security: sec(),
        responses: {
          200: { description: 'Updated', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, modifiedCount: { type: 'integer' } } } } } },
          401: ref('Unauthorized'),
        },
      },
    },

    '/api/notifications/{id}/read': {
      patch: {
        tags: ['Push Notifications'],
        summary: 'Mark notification as read',
        security: sec(),
        parameters: [{ $ref: '#/components/parameters/MongoId' }],
        responses: {
          200: { description: 'Updated', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, notification: { $ref: '#/components/schemas/PushNotification' } } } } } },
          401: ref('Unauthorized'),
          404: ref('NotFound'),
        },
      },
    },

    '/api/notifications/{id}': {
      delete: {
        tags: ['Push Notifications'],
        summary: 'Delete notification',
        security: sec(),
        parameters: [{ $ref: '#/components/parameters/MongoId' }],
        responses: {
          200: { description: 'Deleted' },
          401: ref('Unauthorized'),
          404: ref('NotFound'),
        },
      },
    },

    '/api/notifications/broadcast': {
      post: {
        tags: ['Push Notifications · Admin'],
        summary: 'Broadcast push notification',
        description: 'Admin only. Broadcast to all active users or a specified user ID list.',
        security: adminSec(),
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/BroadcastNotificationRequest' } } } },
        responses: {
          200: { description: 'Sent inline (no Redis)' },
          202: { description: 'Queued for delivery' },
          401: ref('Unauthorized'),
          403: ref('Forbidden'),
          400: ref('ValidationError'),
        },
      },
    },

    '/api/notifications/topic': {
      post: {
        tags: ['Push Notifications · Admin'],
        summary: 'Send to FCM topic',
        security: adminSec(),
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['topic', 'title', 'body'],
                properties: {
                  topic: { type: 'string', example: 'company_bangarProperties' },
                  title: { type: 'string' },
                  body: { type: 'string' },
                  image: { type: 'string', format: 'uri' },
                  data: { type: 'object', additionalProperties: true },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Sent' }, 202: { description: 'Queued' }, 401: ref('Unauthorized'), 403: ref('Forbidden') },
      },
    },

    '/api/notifications/user': {
      post: {
        tags: ['Push Notifications · Admin'],
        summary: 'Send push to specific user',
        security: adminSec(),
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['userId', 'title', 'body'],
                properties: {
                  userId: { type: 'string' },
                  title: { type: 'string' },
                  body: { type: 'string' },
                  data: { type: 'object', additionalProperties: true },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Sent' }, 202: { description: 'Queued' }, 401: ref('Unauthorized'), 403: ref('Forbidden') },
      },
    },

    '/api/notifications/schedule': {
      post: {
        tags: ['Push Notifications · Admin'],
        summary: 'Schedule future push notification',
        description: 'Requires Redis (`REDIS_URL`). Sends at the specified future datetime.',
        security: adminSec(),
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ScheduleNotificationRequest' } } } },
        responses: {
          202: { description: 'Scheduled', content: { 'application/json': { schema: { type: 'object', properties: { queued: { type: 'boolean' }, jobId: { type: 'string' } } } } } },
          400: ref('ValidationError'),
          401: ref('Unauthorized'),
          403: ref('Forbidden'),
        },
      },
    },
  };
}

export default buildNotificationPaths;
