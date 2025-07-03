// app/api/dashboards/reset/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { Redis } from '@upstash/redis';

export async function GET(request: NextRequest) {
  try {
    const redis = new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    });

    // The key for your dashboards array
    const DASHBOARDS_KEY = 'dashboards';

    // Delete the key from Redis
    await redis.del(DASHBOARDS_KEY);

    return NextResponse.json({ message: 'All dashboard data has been successfully cleared.' });

  } catch (error) {
    console.error("Failed to reset dashboards:", error);
    return new NextResponse(JSON.stringify({ error: 'Failed to reset dashboards' }), { status: 500 });
  }
}