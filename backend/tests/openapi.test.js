/**
 * @jest-environment node
 */
import { describe, it, expect } from '@jest/globals';
import { buildSwaggerSpec } from '../config/swagger.js';

describe('OpenAPI documentation', () => {
  it('generates OpenAPI 3.1 spec', () => {
    const spec = buildSwaggerSpec();
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info.title).toBeTruthy();
  });

  it('documents authentication scheme', () => {
    const spec = buildSwaggerSpec();
    expect(spec.components.securitySchemes.BearerAuth).toBeDefined();
    expect(spec.components.securitySchemes.BearerAuth.type).toBe('http');
    expect(spec.components.securitySchemes.BearerAuth.scheme).toBe('bearer');
  });

  it('includes meeting and notification paths', () => {
    const spec = buildSwaggerSpec();
    expect(spec.paths['/api/v1/admin/meetings']).toBeDefined();
    expect(spec.paths['/api/v1/admin/meetings'].get).toBeDefined();
    expect(spec.paths['/api/v1/admin/meetings'].post).toBeDefined();
    expect(spec.paths['/api/device/register']).toBeDefined();
    expect(spec.paths['/api/notifications']).toBeDefined();
  });

  it('includes company-scoped paths with company parameter', () => {
    const spec = buildSwaggerSpec();
    expect(spec.paths['/api/v1/{company}/auth/login']).toBeDefined();
    expect(spec.paths['/api/v1/{company}/employees']).toBeDefined();
    expect(spec.components.parameters.CompanySlug).toBeDefined();
  });

  it('includes reusable schemas and error responses', () => {
    const spec = buildSwaggerSpec();
    expect(spec.components.schemas.Meeting).toBeDefined();
    expect(spec.components.schemas.PushNotification).toBeDefined();
    expect(spec.components.schemas.ValidationErrorResponse).toBeDefined();
    expect(spec.components.responses.Unauthorized).toBeDefined();
  });

  it('documents sufficient API surface', () => {
    const spec = buildSwaggerSpec();
    const pathCount = Object.keys(spec.paths).length;
    expect(pathCount).toBeGreaterThan(100);
  });
});
