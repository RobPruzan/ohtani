import { createClient } from 'redis';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shortId = searchParams.get('id');

    if (!shortId) {
      return NextResponse.json({ error: 'Short ID is required' }, { status: 400 });
    }

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      return NextResponse.json({ error: 'Redis not configured' }, { status: 500 });
    }

    const redis = createClient({ url: redisUrl });
    await redis.connect();

    const planData = await redis.get(`plan:${shortId}`);
    await redis.quit();

    if (!planData) {
      return NextResponse.json({ error: 'Plan not found or expired' }, { status: 404 });
    }

    const plan = JSON.parse(planData);
    return NextResponse.json({ plan }, { status: 200 });
  } catch (error) {
    console.error('Expand error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve plan', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
