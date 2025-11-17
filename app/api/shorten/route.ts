import { createClient } from 'redis';
import { NextRequest, NextResponse } from 'next/server';

// Generate a short ID (6 characters)
function generateShortId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const { plan } = await req.json();

    if (!plan) {
      return NextResponse.json({ error: 'Plan data is required' }, { status: 400 });
    }

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      return NextResponse.json({ error: 'Redis not configured' }, { status: 500 });
    }

    const redis = createClient({ url: redisUrl });
    await redis.connect();

    // Generate unique short ID
    let shortId = generateShortId();
    let attempts = 0;
    while (await redis.exists(`plan:${shortId}`) && attempts < 5) {
      shortId = generateShortId();
      attempts++;
    }

    if (attempts >= 5) {
      await redis.quit();
      return NextResponse.json({ error: 'Failed to generate unique ID' }, { status: 500 });
    }

    // Store plan data with 90 day expiration
    await redis.setEx(`plan:${shortId}`, 90 * 24 * 60 * 60, JSON.stringify(plan));
    await redis.quit();

    return NextResponse.json({ shortId }, { status: 200 });
  } catch (error) {
    console.error('Shorten error:', error);
    return NextResponse.json(
      { error: 'Failed to create short link', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
