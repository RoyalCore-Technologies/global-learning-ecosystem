export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    correlationId?: string;
    page?: number;
    pageSize?: number;
    total?: number;
  };
}
