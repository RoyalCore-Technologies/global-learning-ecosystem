import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ServiceHealth } from '@platform/types';
import { HealthService } from './health.service.js';

@ApiTags('System & Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'API service health check and uptime probe' })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy and accepting requests'
  })
  check(): ServiceHealth {
    return this.healthService.getHealth();
  }
}
