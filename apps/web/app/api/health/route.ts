import { NextResponse } from 'next/server';
import { ServiceHealth } from '@prajeeth/types';

const startTime = Date.now();

export async function GET() {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  const health: ServiceHealth = {
    status: 'ok',
    service: 'prajeeth-ecosystem-web',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds,
    environment: process.env.NODE_ENV || 'development',
    details: {
      framework: 'Next.js 15 (App Router)',
      runtime: 'Node.js',
    },
  };

  return NextResponse.json(health, { status: 200 });
}
