export type HealthStatus = 'ok' | 'degraded' | 'down';

export interface ServiceHealth {
  status: HealthStatus;
  service: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  details?: Record<string, unknown>;
}

export interface SystemHealthSummary {
  status: HealthStatus;
  timestamp: string;
  services: {
    api: ServiceHealth;
    web?: ServiceHealth;
    database?: {
      status: HealthStatus;
      latencyMs?: number;
    };
  };
}
