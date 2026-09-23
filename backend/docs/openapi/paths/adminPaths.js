/**
 * OpenAPI paths for central admin & meeting app APIs.
 * @module docs/openapi/paths/adminPaths
 */

function ref(name) {
  return { $ref: `#/components/responses/${name}` };
}

function sec() {
  return [{ BearerAuth: [] }];
}

/** @returns {Record<string, object>} */
export function buildAdminPaths() {
  return {
    '/': {
      get: {
        tags: ['Health'],
        summary: 'API health check',
        responses: {
          200: { description: 'Welcome message', content: { 'text/plain': { schema: { type: 'string', example: 'Welcome to the CRM API' } } } },
        },
      },
    },

    '/api/v1/admin/auth/login': {
      post: {
        tags: ['Admin · Auth'],
        summary: 'Central admin / meeting app login',
        description:
          'Authenticates Create Team users (CEO, EA, Meeting Coordinator) or company CRM employees. Returns JWT.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: {
          200: { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
          400: ref('ValidationError'),
          401: ref('Unauthorized'),
          500: ref('ServerError'),
        },
      },
    },

    '/api/v1/admin/ceo-team': {
      get: {
        tags: ['Admin · Team'],
        summary: 'List central admin team members',
        responses: { 200: { description: 'Team list' }, 500: ref('ServerError') },
      },
      post: {
        tags: ['Admin · Team'],
        summary: 'Create central admin team member',
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/GenericResource' } } } },
        responses: { 201: { description: 'Created' }, 400: ref('ValidationError'), 500: ref('ServerError') },
      },
    },

    '/api/v1/admin/ceo-team/{id}': {
      put: {
        tags: ['Admin · Team'],
        summary: 'Update central admin team member',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/GenericResource' } } } },
        responses: {
          200: { description: 'Updated' },
          400: ref('ValidationError'),
          403: ref('Unauthorized'),
          404: ref('NotFound'),
          500: ref('ServerError'),
        },
      },
      delete: {
        tags: ['Admin · Team'],
        summary: 'Delete central admin team member',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Deleted' },
          403: ref('Unauthorized'),
          404: ref('NotFound'),
          500: ref('ServerError'),
        },
      },
    },

    '/api/v1/admin/companies': {
      get: { tags: ['Admin · Tenants'], summary: 'List all companies', responses: { 200: { description: 'Companies' } } },
    },
    '/api/v1/admin/tenants': {
      get: { tags: ['Admin · Tenants'], summary: 'List company tenants', responses: { 200: { description: 'Tenants' } } },
    },
    '/api/v1/admin/companies/{tenantId}/dashboard': {
      get: {
        tags: ['Admin · Tenants'],
        summary: 'Tenant dashboard overview',
        parameters: [{ name: 'tenantId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Dashboard' }, 404: ref('NotFound') },
      },
    },
    '/api/v1/admin/companies/{tenantId}/employees': {
      get: {
        tags: ['Admin · Tenants'],
        summary: 'List tenant employees',
        parameters: [{ name: 'tenantId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Employees' } },
      },
    },
    '/api/v1/admin/companies/{tenantId}/employees/{employeeId}': {
      get: {
        tags: ['Admin · Tenants'],
        summary: 'Tenant employee profile',
        parameters: [
          { name: 'tenantId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'employeeId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Profile' }, 404: ref('NotFound') },
      },
    },
    '/api/v1/admin/companies/{tenantId}/modules/{module}': {
      get: {
        tags: ['Admin · Tenants'],
        summary: 'Generic tenant module list',
        parameters: [
          { name: 'tenantId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'module', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Module data' } },
      },
    },
    '/api/v1/admin/companies/{tenantId}/clients/{clientId}/dashboard': {
      get: {
        tags: ['Admin · Tenants'],
        summary: 'Cross-tenant client dashboard',
        parameters: [
          { name: 'tenantId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'clientId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Dashboard' } },
      },
    },
    '/api/v1/admin/companies/{tenantId}/projects/{projectId}/dashboard': {
      get: {
        tags: ['Admin · Tenants'],
        summary: 'Cross-tenant project dashboard',
        parameters: [
          { name: 'tenantId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Dashboard' } },
      },
    },
    '/api/v1/admin/companies/{tenantId}/tasks/{taskId}': {
      get: {
        tags: ['Admin · Tenants'],
        summary: 'Cross-tenant task overview',
        parameters: [
          { name: 'tenantId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'taskId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Task overview' } },
      },
    },
    '/api/v1/admin/companies/{tenantId}/invoices/{invoiceId}': {
      get: {
        tags: ['Admin · Tenants'],
        summary: 'Cross-tenant invoice overview',
        parameters: [
          { name: 'tenantId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'invoiceId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Invoice overview' } },
      },
    },
    '/api/v1/admin/companies/{tenantId}/leaves/{leaveId}/status': {
      patch: {
        tags: ['Admin · Tenants'],
        summary: 'Final leave decision for tenant employee',
        parameters: [
          { name: 'tenantId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'leaveId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' } } } } } },
        responses: { 200: { description: 'Updated' } },
      },
    },

    '/api/v1/admin/device/register': {
      post: {
        tags: ['Push Notifications'],
        summary: 'Register FCM device token (admin path)',
        description: 'Legacy alias — same handler as `POST /api/device/register`.',
        security: sec(),
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/DeviceRegisterRequest' } } } },
        responses: {
          200: { description: 'Registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/DeviceRegisterResponse' } } } },
          401: ref('Unauthorized'),
          429: ref('RateLimitExceeded'),
          500: ref('ServerError'),
        },
      },
    },

    '/api/v1/admin/boss': {
      get: {
        tags: ['Meetings'],
        summary: 'Get CEO / Boss profile',
        security: sec(),
        responses: {
          200: { description: 'Boss profile', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' }, role: { type: 'string' } } } } } },
          404: ref('NotFound'),
        },
      },
    },

    '/api/v1/admin/meetings': {
      get: {
        tags: ['Meetings'],
        summary: 'List meetings',
        security: sec(),
        parameters: [
          { name: 'forBoss', in: 'query', schema: { type: 'string', enum: ['true', 'false', '1', '0'] }, description: 'Filter to boss meetings' },
          { name: 'organizerId', in: 'query', schema: { type: 'string' }, description: 'Filter by organizer' },
        ],
        responses: {
          200: { description: 'Meeting list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Meeting' } } } } },
          500: ref('ServerError'),
        },
      },
      post: {
        tags: ['Meetings'],
        summary: 'Create meeting',
        description: 'Coordinator-created meetings are auto-approved; EA-created meetings require coordinator approval.',
        security: sec(),
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/MeetingCreateRequest' } } } },
        responses: {
          201: { description: 'Meeting created', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' }, meeting: { $ref: '#/components/schemas/Meeting' } } } } } },
          400: ref('ValidationError'),
          409: { description: 'Schedule conflict' },
          500: ref('ServerError'),
        },
      },
    },

    '/api/v1/admin/meetings/{id}': {
      get: {
        tags: ['Meetings'],
        summary: 'Get meeting by ID',
        security: sec(),
        parameters: [{ $ref: '#/components/parameters/MongoId' }],
        responses: {
          200: { description: 'Meeting', content: { 'application/json': { schema: { $ref: '#/components/schemas/Meeting' } } } },
          404: ref('NotFound'),
        },
      },
      put: {
        tags: ['Meetings'],
        summary: 'Update meeting',
        description: 'Supports RSVP, reschedule, coordinator approval, and schedule changes.',
        security: sec(),
        parameters: [{ $ref: '#/components/parameters/MongoId' }],
        requestBody: { content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/MeetingCreateRequest' }, { type: 'object', properties: { coordinatorApproval: { type: 'string', enum: ['pending', 'approved', 'rejected'] }, bossResponse: { type: 'string' }, clearRescheduleRequest: { type: 'boolean' } } }] } } } },
        responses: {
          200: { description: 'Updated', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' }, meeting: { $ref: '#/components/schemas/Meeting' } } } } } },
          404: ref('NotFound'),
          409: { description: 'Schedule conflict' },
        },
      },
      delete: {
        tags: ['Meetings'],
        summary: 'Delete meeting',
        security: sec(),
        parameters: [{ $ref: '#/components/parameters/MongoId' }],
        responses: { 200: { description: 'Deleted' }, 404: ref('NotFound') },
      },
    },
  };
}

export default buildAdminPaths;
