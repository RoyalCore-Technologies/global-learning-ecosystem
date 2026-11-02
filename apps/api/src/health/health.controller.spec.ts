import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

describe('HealthController', () => {
  let controller: HealthController;
  let service: HealthService;

  beforeEach(() => {
    const configService = {
      get: (_key: string, defaultVal: string) => defaultVal
    } as unknown as ConfigService;
    service = new HealthService(configService);
    controller = new HealthController(service);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return service health status with ok', () => {
    const health = controller.check();
    expect(health.status).toBe('ok');
    expect(health.service).toBe('platform-api');
    expect(health.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(health.timestamp).toBeDefined();
  });
});
