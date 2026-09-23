/**
 * Programmatic OpenAPI paths for `/api/v1/{company}/*` modules.
 * All four tenants share identical route structures.
 * @module docs/openapi/paths/companyPaths
 */

const companyParams = [{ $ref: '#/components/parameters/CompanySlug' }];

function ref(name) {
  return { $ref: `#/components/responses/${name}` };
}

function sec() {
  return [{ BearerAuth: [] }];
}

function crud(tag, resource, path, idName = 'id', extraListParams = []) {
  const itemPath = `/api/v1/{company}${path}/{${idName}}`;
  const listPath = `/api/v1/{company}${path}`;

  return {
    [listPath]: {
      get: {
        tags: [tag],
        summary: `List ${resource}`,
        parameters: [...companyParams, ...extraListParams.map((p) => ({ $ref: `#/components/parameters/${p}` }))],
        responses: {
          200: { description: `${resource} list`, content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/GenericResource' } } } } },
          500: ref('ServerError'),
        },
      },
      post: {
        tags: [tag],
        summary: `Create ${resource}`,
        security: sec(),
        parameters: companyParams,
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/GenericResource' } } } },
        responses: {
          201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/GenericResource' } } } },
          400: ref('ValidationError'),
          401: ref('Unauthorized'),
          500: ref('ServerError'),
        },
      },
    },
    [itemPath]: {
      get: {
        tags: [tag],
        summary: `Get ${resource} by ID`,
        parameters: [...companyParams, { $ref: '#/components/parameters/MongoId' }],
        responses: {
          200: { description: 'Resource', content: { 'application/json': { schema: { $ref: '#/components/schemas/GenericResource' } } } },
          404: ref('NotFound'),
          500: ref('ServerError'),
        },
      },
      put: {
        tags: [tag],
        summary: `Update ${resource}`,
        security: sec(),
        parameters: [...companyParams, { $ref: '#/components/parameters/MongoId' }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/GenericResource' } } } },
        responses: {
          200: { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/GenericResource' } } } },
          401: ref('Unauthorized'),
          404: ref('NotFound'),
          500: ref('ServerError'),
        },
      },
      delete: {
        tags: [tag],
        summary: `Delete ${resource}`,
        security: sec(),
        parameters: [...companyParams, { $ref: '#/components/parameters/MongoId' }],
        responses: {
          200: { description: 'Deleted', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          401: ref('Unauthorized'),
          404: ref('NotFound'),
          500: ref('ServerError'),
        },
      },
    },
  };
}

/** @returns {Record<string, object>} */
export function buildCompanyPaths() {
  const paths = {};

  // Auth
  Object.assign(paths, {
    '/api/v1/{company}/auth/login': {
      post: {
        tags: ['Company · Auth'],
        summary: 'Company employee login',
        parameters: companyParams,
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: {
          200: { description: 'JWT token', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
          401: ref('Unauthorized'),
          500: ref('ServerError'),
        },
      },
    },
  });

  // CRUD modules
  const modules = [
    ['Company · Designations', 'designation', '/designations'],
    ['Company · Employees', 'employee', '/employees'],
    ['Company · Clients', 'client', '/clients'],
    ['Company · Projects', 'project', '/projects'],
    ['Company · Tasks', 'task', '/tasks'],
    ['Company · Leads', 'lead', '/leads'],
    ['Company · Collaborators', 'collaborator', '/collaborators'],
    ['Company · Salaries', 'salary', '/salaries'],
    ['Company · Billing', 'billing record', '/billing'],
    ['Company · Quotations', 'quotation', '/quotations'],
    ['Company · Expenses', 'expense', '/expenses'],
    ['Company · Assets', 'asset', '/assets'],
    ['Company · Sub-companies', 'sub-company', '/companies'],
    ['Company · Announcements', 'announcement', '/announcements'],
  ];

  for (const [tag, name, p] of modules) {
    Object.assign(paths, crud(tag, name, p));
  }

  // Employee extras
  Object.assign(paths, {
    '/api/v1/{company}/employees/availability': {
      get: {
        tags: ['Company · Employees'],
        summary: 'Check employee availability',
        parameters: companyParams,
        responses: { 200: { description: 'Availability data' } },
      },
    },
    '/api/v1/{company}/employees/{id}/profile': {
      get: {
        tags: ['Company · Employees'],
        summary: 'Get employee full profile',
        parameters: [...companyParams, { $ref: '#/components/parameters/MongoId' }],
        responses: {
          200: { description: 'Employee profile', content: { 'application/json': { schema: { $ref: '#/components/schemas/GenericResource' } } } },
          404: ref('NotFound'),
        },
      },
    },
  });

  // Client dashboard
  Object.assign(paths, {
    '/api/v1/{company}/clients/{id}/dashboard': {
      get: {
        tags: ['Company · Clients'],
        summary: 'Client dashboard',
        parameters: [...companyParams, { $ref: '#/components/parameters/MongoId' }],
        responses: { 200: { description: 'Dashboard payload' } },
      },
    },
  });

  // Project extras
  Object.assign(paths, {
    '/api/v1/{company}/projects/stats/by-month': {
      get: { tags: ['Company · Projects'], summary: 'Project stats by month', parameters: companyParams, responses: { 200: { description: 'Stats' } } },
    },
    '/api/v1/{company}/projects/my-projects': {
      get: { tags: ['Company · Projects'], summary: 'Current user projects', security: sec(), parameters: companyParams, responses: { 200: { description: 'Projects' } } },
    },
    '/api/v1/{company}/projects/{id}/dashboard': {
      get: { tags: ['Company · Projects'], summary: 'Project dashboard', parameters: [...companyParams, { $ref: '#/components/parameters/MongoId' }], responses: { 200: { description: 'Dashboard' } } },
    },
  });

  // Lead follow-up
  Object.assign(paths, {
    '/api/v1/{company}/leads/{id}/follow-up': {
      post: {
        tags: ['Company · Leads'],
        summary: 'Add lead follow-up',
        security: sec(),
        parameters: [...companyParams, { $ref: '#/components/parameters/MongoId' }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/GenericResource' } } } },
        responses: { 201: { description: 'Follow-up added' } },
      },
    },
  });

  // Attendance
  const attendanceActions = [
    ['check-in', 'Check in'],
    ['check-out', 'Check out'],
    ['break/start', 'Start break'],
    ['break/end', 'End break'],
    ['meeting/start', 'Start meeting (attendance)'],
    ['meeting/end', 'End meeting (attendance)'],
    ['location-update', 'Update GPS location'],
    ['check-in-address', 'Set check-in address'],
    ['check-out-address', 'Set check-out address'],
  ];
  for (const [action, label] of attendanceActions) {
    paths[`/api/v1/{company}/attendance/${action}`] = {
      post: {
        tags: ['Company · Attendance'],
        summary: label,
        security: sec(),
        parameters: companyParams,
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/GenericResource' } } } },
        responses: { 200: { description: 'Success' }, 400: ref('ValidationError'), 401: ref('Unauthorized') },
      },
    };
  }
  Object.assign(paths, {
    '/api/v1/{company}/attendance/today': {
      get: { tags: ['Company · Attendance'], summary: "Today's attendance", security: sec(), parameters: companyParams, responses: { 200: { description: 'Records' } } },
    },
    '/api/v1/{company}/attendance/by-month': {
      get: { tags: ['Company · Attendance'], summary: 'Monthly attendance', security: sec(), parameters: companyParams, responses: { 200: { description: 'Records' } } },
    },
    '/api/v1/{company}/attendance/employee/{employeeId}': {
      get: { tags: ['Company · Attendance'], summary: 'Attendance by employee', security: sec(), parameters: [...companyParams, { name: 'employeeId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Records' } } },
    },
  });

  // Leave
  Object.assign(paths, {
    '/api/v1/{company}/leave': {
      get: { tags: ['Company · Leave'], summary: 'List leave requests', security: sec(), parameters: companyParams, responses: { 200: { description: 'Leave list' } } },
      post: { tags: ['Company · Leave'], summary: 'Create leave request', security: sec(), parameters: companyParams, requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/GenericResource' } } } }, responses: { 201: { description: 'Created' } } },
    },
    '/api/v1/{company}/leave/{id}': {
      get: { tags: ['Company · Leave'], summary: 'Get leave by ID', security: sec(), parameters: [...companyParams, { $ref: '#/components/parameters/MongoId' }], responses: { 200: { description: 'Leave' } } },
    },
    '/api/v1/{company}/leave/{id}/status': {
      patch: { tags: ['Company · Leave'], summary: 'Update leave status', security: sec(), parameters: [...companyParams, { $ref: '#/components/parameters/MongoId' }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' } } } } } }, responses: { 200: { description: 'Updated' } } },
    },
  });

  // Billing tracking
  Object.assign(paths, {
    '/api/v1/{company}/billing/tracking/{clientId}': {
      get: { tags: ['Company · Billing'], summary: 'Billing tracking per client', parameters: [...companyParams, { name: 'clientId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Tracking data' } } },
    },
  });

  // Asset assign
  Object.assign(paths, {
    '/api/v1/{company}/assets/{id}/assign': {
      patch: { tags: ['Company · Assets'], summary: 'Assign asset to employee', security: sec(), parameters: [...companyParams, { $ref: '#/components/parameters/MongoId' }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { employeeId: { type: 'string' } } } } } }, responses: { 200: { description: 'Assigned' } } },
    },
  });

  // Documents (files, contracts, policies)
  for (const docType of ['files', 'contracts', 'policies']) {
    Object.assign(paths, crud(`Company · Documents (${docType})`, docType.slice(0, -1), `/${docType}`));
  }

  // Client profiles
  Object.assign(paths, {
    '/api/v1/{company}/client-profiles': {
      get: { tags: ['Company · Client Profiles'], summary: 'List client profiles', parameters: companyParams, responses: { 200: { description: 'Profiles' } } },
      post: { tags: ['Company · Client Profiles'], summary: 'Create client profile', security: sec(), parameters: companyParams, requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/GenericResource' } } } }, responses: { 201: { description: 'Created' } } },
    },
    '/api/v1/{company}/client-profiles/by-client/{clientId}': {
      get: { tags: ['Company · Client Profiles'], summary: 'Profile by client ID', parameters: [...companyParams, { name: 'clientId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Profile' } } },
    },
    '/api/v1/{company}/client-profiles/{id}': {
      get: { tags: ['Company · Client Profiles'], summary: 'Get profile', parameters: [...companyParams, { $ref: '#/components/parameters/MongoId' }], responses: { 200: { description: 'Profile' } } },
      put: { tags: ['Company · Client Profiles'], summary: 'Update profile (full)', security: sec(), parameters: [...companyParams, { $ref: '#/components/parameters/MongoId' }], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/GenericResource' } } } }, responses: { 200: { description: 'Updated' } } },
      patch: { tags: ['Company · Client Profiles'], summary: 'Partial update', security: sec(), parameters: [...companyParams, { $ref: '#/components/parameters/MongoId' }], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/GenericResource' } } } }, responses: { 200: { description: 'Updated' } } },
      delete: { tags: ['Company · Client Profiles'], summary: 'Delete profile', security: sec(), parameters: [...companyParams, { $ref: '#/components/parameters/MongoId' }], responses: { 200: { description: 'Deleted' } } },
    },
  });

  // Company profile
  Object.assign(paths, {
    '/api/v1/{company}/company-profile': {
      get: { tags: ['Company · Profile'], summary: 'Get company profile', parameters: companyParams, responses: { 200: { description: 'Profile' } } },
      put: { tags: ['Company · Profile'], summary: 'Upsert company profile', security: sec(), parameters: companyParams, requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/GenericResource' } } } }, responses: { 200: { description: 'Saved' } } },
    },
  });

  // Locations
  Object.assign(paths, {
    '/api/v1/{company}/locations/states': {
      get: { tags: ['Company · Locations'], summary: 'List Indian states', parameters: companyParams, responses: { 200: { description: 'States' } } },
    },
    '/api/v1/{company}/locations/cities': {
      get: { tags: ['Company · Locations'], summary: 'Cities by state', parameters: [...companyParams, { name: 'state', in: 'query', schema: { type: 'string' } }], responses: { 200: { description: 'Cities' } } },
    },
  });

  // Chat
  const chatPaths = [
    ['GET', '/chat/integration', 'Chat integration config'],
    ['GET', '/chat/team', 'Team chat room'],
    ['GET', '/chat/conversations', 'List conversations'],
    ['POST', '/chat/conversations', 'Create or get DM'],
    ['GET', '/chat/conversations/{id}/messages', 'Get messages'],
    ['POST', '/chat/conversations/{id}/messages', 'Send message'],
    ['POST', '/chat/conversations/{id}/polls', 'Create poll'],
    ['POST', '/chat/messages/{messageId}/vote', 'Vote on poll'],
    ['PATCH', '/chat/conversations/{id}/read', 'Mark conversation read'],
    ['GET', '/chat/employees', 'Employees for chat picker'],
  ];
  for (const [method, p, summary] of chatPaths) {
    const key = `/api/v1/{company}${p}`;
    paths[key] = paths[key] || {};
    paths[key][method.toLowerCase()] = {
      tags: ['Company · Chat'],
      summary,
      security: sec(),
      parameters: [...companyParams, ...(p.includes('{') ? [{ $ref: '#/components/parameters/MongoId' }] : [])],
      responses: { 200: { description: 'Success' }, 401: ref('Unauthorized') },
      ...(method === 'POST' || method === 'PATCH' ? { requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/GenericResource' } } } } } : {}),
    };
  }

  // Social media calendar
  Object.assign(paths, {
    '/api/v1/{company}/social-calendars': {
      get: { tags: ['Company · Social Calendar'], summary: 'List calendars', parameters: companyParams, responses: { 200: { description: 'Calendars' } } },
      post: { tags: ['Company · Social Calendar'], summary: 'Create calendar', security: sec(), parameters: companyParams, responses: { 201: { description: 'Created' } } },
    },
    '/api/v1/{company}/social-calendars/client/{clientId}': {
      get: { tags: ['Company · Social Calendar'], summary: 'Calendar by client', parameters: [...companyParams, { name: 'clientId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Calendar' } } },
    },
    '/api/v1/{company}/social-calendars/client/{clientId}/posts': {
      post: { tags: ['Company · Social Calendar'], summary: 'Add post', security: sec(), parameters: [...companyParams, { name: 'clientId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 201: { description: 'Post added' } } },
    },
    '/api/v1/{company}/social-calendars/shared/{token}': {
      get: { tags: ['Company · Social Calendar'], summary: 'Public shared calendar view', parameters: [...companyParams, { name: 'token', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Shared calendar' } } },
    },
  });

  // Company-scoped in-app notifications (legacy CRM)
  Object.assign(paths, {
    '/api/v1/{company}/notifications': {
      get: {
        tags: ['Company · In-App Notifications'],
        summary: 'List in-app notifications',
        security: sec(),
        parameters: [...companyParams, { $ref: '#/components/parameters/Page' }, { $ref: '#/components/parameters/Limit' }],
        responses: {
          200: { description: 'Notifications', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/InAppNotification' } } } } },
          401: ref('Unauthorized'),
        },
      },
      post: {
        tags: ['Company · In-App Notifications'],
        summary: 'Create in-app notification',
        security: sec(),
        parameters: companyParams,
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/InAppNotification' } } } },
        responses: { 201: { description: 'Created' } },
      },
    },
    '/api/v1/{company}/notifications/unread-count': {
      get: { tags: ['Company · In-App Notifications'], summary: 'Unread count', security: sec(), parameters: companyParams, responses: { 200: { description: 'Count' } } },
    },
    '/api/v1/{company}/notifications/read-all': {
      patch: { tags: ['Company · In-App Notifications'], summary: 'Mark all read', security: sec(), parameters: companyParams, responses: { 200: { description: 'Updated' } } },
    },
    '/api/v1/{company}/notifications/{id}/read': {
      patch: { tags: ['Company · In-App Notifications'], summary: 'Mark one read', security: sec(), parameters: [...companyParams, { $ref: '#/components/parameters/MongoId' }], responses: { 200: { description: 'Updated' } } },
    },
    '/api/v1/{company}/notifications/{id}': {
      delete: { tags: ['Company · In-App Notifications'], summary: 'Delete notification', security: sec(), parameters: [...companyParams, { $ref: '#/components/parameters/MongoId' }], responses: { 200: { description: 'Deleted' } } },
    },
  });

  return paths;
}

export default buildCompanyPaths;
