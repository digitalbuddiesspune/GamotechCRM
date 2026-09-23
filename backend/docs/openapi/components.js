/**
 * Reusable OpenAPI 3.1 components (schemas, responses, security).
 * @module docs/openapi/components
 */

export const companySlugParam = {
  name: 'company',
  in: 'path',
  required: true,
  description: 'Company tenant slug',
  schema: {
    type: 'string',
    enum: ['gamotechSolution'],
  },
};

export const components = {
  securitySchemes: {
    BearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description:
        'JWT obtained from `POST /api/v1/admin/auth/login` or `POST /api/v1/{company}/auth/login`. ' +
        'Include as `Authorization: Bearer <token>`.',
    },
  },
  parameters: {
    CompanySlug: companySlugParam,
    Page: {
      name: 'page',
      in: 'query',
      schema: { type: 'integer', minimum: 1, default: 1 },
      description: 'Page number (1-based)',
    },
    Limit: {
      name: 'limit',
      in: 'query',
      schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      description: 'Items per page',
    },
    Sort: {
      name: 'sort',
      in: 'query',
      schema: { type: 'string', enum: ['newest', 'oldest'] },
      description: 'Sort order for lists',
    },
    Search: {
      name: 'search',
      in: 'query',
      schema: { type: 'string', maxLength: 200 },
      description: 'Case-insensitive search term',
    },
    MongoId: {
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'string', pattern: '^[a-f\\d]{24}$' },
      description: 'MongoDB ObjectId',
    },
  },
  responses: {
    Unauthorized: {
      description: 'Authentication required or token invalid',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorMessage' },
          examples: {
            missing: { value: { message: 'Authentication required' } },
            invalid: { value: { message: 'Invalid or expired token' } },
          },
        },
      },
    },
    Forbidden: {
      description: 'Insufficient permissions',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
        },
      },
    },
    NotFound: {
      description: 'Resource not found',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorMessage' },
        },
      },
    },
    ValidationError: {
      description: 'Request validation failed',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
        },
      },
    },
    RateLimitExceeded: {
      description: 'Too many requests',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/RateLimitError' },
        },
      },
    },
    ServerError: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
        },
      },
    },
  },
  schemas: {
    ErrorMessage: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
      required: ['message'],
    },
    ErrorResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string' },
        code: { type: 'string' },
        error: { type: 'string' },
      },
    },
    ValidationErrorResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Validation failed' },
        errors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              msg: { type: 'string' },
              path: { type: 'string' },
              location: { type: 'string' },
            },
          },
        },
      },
    },
    RateLimitError: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Too many requests. Please try again later.' },
        code: { type: 'string', example: 'RATE_LIMIT_EXCEEDED' },
      },
    },
    SuccessResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
      },
    },
    PaginationMeta: {
      type: 'object',
      properties: {
        page: { type: 'integer' },
        limit: { type: 'integer' },
        total: { type: 'integer' },
        totalPages: { type: 'integer' },
      },
    },
    PaginatedResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        items: { type: 'array', items: {} },
        pagination: { $ref: '#/components/schemas/PaginationMeta' },
      },
    },
    LoginRequest: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email', example: 'admin@example.com' },
        password: { type: 'string', format: 'password', minLength: 1 },
      },
    },
    LoginResponse: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Login successful' },
        token: { type: 'string', description: 'JWT bearer token' },
        expiresIn: { type: 'string', example: '30d' },
        user: { type: 'object', additionalProperties: true },
      },
    },
    DeviceRegisterRequest: {
      type: 'object',
      required: ['deviceToken'],
      properties: {
        deviceToken: { type: 'string', description: 'FCM device token' },
        platform: {
          type: 'string',
          enum: ['android', 'ios', 'web', 'unknown'],
          default: 'unknown',
        },
      },
    },
    DeviceRegisterResponse: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Device registered' },
        device: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            platform: { type: 'string' },
            lastSeen: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    PushNotification: {
      type: 'object',
      properties: {
        _id: { type: 'string' },
        receiver: { type: 'string' },
        sender: { type: 'string', nullable: true },
        title: { type: 'string' },
        body: { type: 'string' },
        type: {
          type: 'string',
          enum: [
            'meeting_assigned',
            'meeting_reminder',
            'meeting_updated',
            'meeting_cancelled',
            'meeting_pending',
            'system',
            'marketing',
            'broadcast',
          ],
        },
        meetingId: { type: 'string' },
        companyId: { type: 'string' },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'critical'] },
        status: { type: 'string', enum: ['queued', 'sent', 'delivered', 'failed'] },
        read: { type: 'boolean' },
        readAt: { type: 'string', format: 'date-time', nullable: true },
        opened: { type: 'boolean' },
        data: { type: 'object', additionalProperties: true },
        expiresAt: { type: 'string', format: 'date-time', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
    InAppNotification: {
      type: 'object',
      description: 'Company-scoped in-app CRM notification',
      properties: {
        _id: { type: 'string' },
        recipient: { type: 'string' },
        type: { type: 'string' },
        title: { type: 'string' },
        message: { type: 'string' },
        link: { type: 'string' },
        read: { type: 'boolean' },
        priority: { type: 'string', enum: ['low', 'normal', 'high'] },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
    Meeting: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        organizerId: { type: 'string' },
        organizerName: { type: 'string' },
        organizerRole: { type: 'string' },
        bossId: { type: 'string' },
        bossName: { type: 'string' },
        companyId: { type: 'string' },
        companyName: { type: 'string' },
        agenda: { type: 'string' },
        description: { type: 'string' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        status: {
          type: 'string',
          enum: ['scheduled', 'ongoing', 'completed', 'cancelled', 'rescheduled', 'missed'],
        },
        type: { type: 'string' },
        startAt: { type: 'string', format: 'date-time' },
        endAt: { type: 'string', format: 'date-time' },
        meetLink: { type: 'string', nullable: true },
        location: { type: 'string', nullable: true },
        notes: { type: 'string' },
        bossResponse: { type: 'string', enum: ['pending', 'accepted', 'declined'] },
        coordinatorApproval: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
    MeetingCreateRequest: {
      type: 'object',
      required: ['title', 'startAt', 'endAt'],
      properties: {
        title: { type: 'string' },
        startAt: { type: 'string', format: 'date-time' },
        endAt: { type: 'string', format: 'date-time' },
        organizerId: { type: 'string' },
        organizerName: { type: 'string' },
        organizerRole: { type: 'string' },
        companyId: { type: 'string' },
        companyName: { type: 'string' },
        agenda: { type: 'string' },
        description: { type: 'string' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        status: { type: 'string' },
        type: { type: 'string' },
        meetLink: { type: 'string' },
        location: { type: 'string' },
        notes: { type: 'string' },
      },
    },
    BroadcastNotificationRequest: {
      type: 'object',
      required: ['title', 'body'],
      properties: {
        title: { type: 'string', maxLength: 200 },
        body: { type: 'string', maxLength: 1000 },
        userIds: { type: 'array', items: { type: 'string' }, description: 'Omit to broadcast to all active users' },
        data: { type: 'object', additionalProperties: true },
      },
    },
    ScheduleNotificationRequest: {
      type: 'object',
      required: ['title', 'body', 'userIds', 'sendAt'],
      properties: {
        title: { type: 'string', maxLength: 200 },
        body: { type: 'string', maxLength: 1000 },
        userIds: { type: 'array', items: { type: 'string' }, minItems: 1 },
        sendAt: { type: 'string', format: 'date-time', description: 'Future ISO 8601 datetime' },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'critical'] },
        data: { type: 'object', additionalProperties: true },
      },
    },
    GenericResource: {
      type: 'object',
      description: 'Generic CRM resource — fields vary by module',
      additionalProperties: true,
    },
  },
};

export default components;
