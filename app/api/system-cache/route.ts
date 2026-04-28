import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type SystemCachePayload = {
  strategy_list?: string;
  strategy_data?: unknown[];
  strategy_summary?: unknown[];
  strategy_last_updated?: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

function ensureEnv() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase environment variables for system-cache API');
  }
}

function getAdminClient() {
  ensureEnv();
  return createClient(SUPABASE_URL as string, SUPABASE_SERVICE_ROLE_KEY as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function verifyUserAndGetMetadata(token: string) {
  const adminClient = getAdminClient();
  const {
    data: { user },
    error,
  } = await adminClient.auth.getUser(token);

  if (error || !user) {
    return { user: null, error: error?.message || 'Invalid token' };
  }

  const adminResp = await adminClient.auth.admin.getUserById(user.id);
  if (adminResp.error || !adminResp.data.user) {
    return { user: null, error: adminResp.error?.message || 'Failed to load user metadata' };
  }

  return { user: adminResp.data.user, error: null };
}

export async function GET(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Missing bearer token' }, { status: 401 });
    }

    const { user, error } = await verifyUserAndGetMetadata(token);
    if (error || !user) {
      return NextResponse.json({ success: false, error: error || 'Unauthorized' }, { status: 401 });
    }

    const metadata = (user.user_metadata || {}) as SystemCachePayload;

    return NextResponse.json({
      success: true,
      data: {
        strategy_list: metadata.strategy_list || '',
        strategy_data: Array.isArray(metadata.strategy_data) ? metadata.strategy_data : [],
        strategy_summary: Array.isArray(metadata.strategy_summary) ? metadata.strategy_summary : [],
        strategy_last_updated: typeof metadata.strategy_last_updated === 'string' ? metadata.strategy_last_updated : '',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Unexpected server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Missing bearer token' }, { status: 401 });
    }

    const { user, error } = await verifyUserAndGetMetadata(token);
    if (error || !user) {
      return NextResponse.json({ success: false, error: error || 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as SystemCachePayload;

    const currentMeta = (user.user_metadata || {}) as Record<string, unknown>;
    const nextMeta: Record<string, unknown> = { ...currentMeta };

    if (typeof body.strategy_list === 'string') nextMeta.strategy_list = body.strategy_list;
    if (Array.isArray(body.strategy_data)) nextMeta.strategy_data = body.strategy_data;
    if (Array.isArray(body.strategy_summary)) nextMeta.strategy_summary = body.strategy_summary;
    if (typeof body.strategy_last_updated === 'string') nextMeta.strategy_last_updated = body.strategy_last_updated;

    const adminClient = getAdminClient();

    const updateResp = await adminClient.auth.admin.updateUserById(user.id, {
      user_metadata: nextMeta,
    });

    if (updateResp.error) {
      return NextResponse.json({ success: false, error: updateResp.error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        strategy_list: typeof nextMeta.strategy_list === 'string' ? nextMeta.strategy_list : '',
        strategy_data: Array.isArray(nextMeta.strategy_data) ? nextMeta.strategy_data : [],
        strategy_summary: Array.isArray(nextMeta.strategy_summary) ? nextMeta.strategy_summary : [],
        strategy_last_updated: typeof nextMeta.strategy_last_updated === 'string' ? nextMeta.strategy_last_updated : '',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Unexpected server error' }, { status: 500 });
  }
}
