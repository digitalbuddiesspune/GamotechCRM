/**
 * OpenAPI 3.1 specification assembly + Swagger UI integration.
 * @module config/swagger
 */
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { fileURLToPath } from 'url';
import path from 'path';
import { components } from '../docs/openapi/components.js';
import { buildAdminPaths } from '../docs/openapi/paths/adminPaths.js';
import { buildNotificationPaths } from '../docs/openapi/paths/notificationPaths.js';
import { buildCompanyPaths } from '../docs/openapi/paths/companyPaths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

const serverUrl = process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 5011}`;

const swaggerDefinition = {
  openapi: '3.1.0',
  info: {
    title: 'Gamotech Solution CRM API',
    version: '1.0.0',
    description: `
Enterprise CRM REST API.

## Authentication
Most endpoints require a **Bearer JWT** token obtained from:
- \`POST /api/v1/{company}/auth/login\` — Company CRM employees

Click **Authorize** and enter: \`Bearer <your-token>\`

## Company tenant
Replace \`{company}\` with:
\`gamotechSolution\`

## Pagination
List endpoints supporting pagination accept \`page\`, \`limit\`, \`sort\`, and \`search\` query parameters.

## Validation errors
Return HTTP \`400\` with \`{ success: false, message: "Validation failed", errors: [...] }\`
    `.trim(),
    contact: {
      name: 'API Support',
    },
    license: {
      name: 'Proprietary',
    },
  },
  servers: [
    { url: serverUrl, description: process.env.NODE_ENV === 'production' ? 'Production' : 'Local development' },
  ],
  components,
  security: [],
  tags: [
    { name: 'Health' },
    { name: 'Admin · Auth' },
    { name: 'Admin · Team' },
    { name: 'Admin · Tenants' },
    { name: 'Meetings' },
    { name: 'Push Notifications' },
    { name: 'Push Notifications · Admin' },
    { name: 'Company · Auth' },
    { name: 'Company · Employees' },
    { name: 'Company · Clients' },
    { name: 'Company · Projects' },
    { name: 'Company · Tasks' },
    { name: 'Company · Leads' },
    { name: 'Company · Attendance' },
    { name: 'Company · Leave' },
    { name: 'Company · Chat' },
    { name: 'Company · In-App Notifications' },
  ],
};

const jsdocOptions = {
  definition: swaggerDefinition,
  apis: [
    path.join(rootDir, 'docs/openapi/annotations/**/*.js'),
  ],
};

/** Build complete OpenAPI spec (jsdoc + programmatic paths). */
export function buildSwaggerSpec() {
  const spec = swaggerJsdoc(jsdocOptions);

  spec.paths = {
    ...(spec.paths || {}),
    ...buildAdminPaths(),
    ...buildNotificationPaths(),
    ...buildCompanyPaths(),
  };

  return spec;
}

/** Express middleware — mount Swagger UI at `/api/docs`. */
export function mountSwaggerDocs(app) {
  const spec = buildSwaggerSpec();

  const swaggerUiOptions = {
    customSiteTitle: 'CRM API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
      docExpansion: 'list',
    },
  };

  app.use('/api/docs', swaggerUi.serve);
  app.get('/api/docs', swaggerUi.setup(spec, swaggerUiOptions));

  // Raw OpenAPI JSON for tooling / CI
  app.get('/api/docs/openapi.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(spec);
  });

  return spec;
}

export default { buildSwaggerSpec, mountSwaggerDocs };
