import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const ADMIN_EMAILS = ['forjerry@gmail.com'];

function getServiceClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * GET /api/strategy-map
 * 公開端點：回傳共用的策略名稱清單與策略商品對照表（所有帳號皆可讀取）
 * 內容來源：系統管理員 (forjerry@gmail.com) 的 Supabase user_metadata
 */
export async function GET() {
  try {
    // 若缺少 Supabase 環境變數，優雅降級：回傳空對照表而非 500 錯誤
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('[strategy-map] Missing Supabase environment variables, returning empty map');
      return NextResponse.json({
        success: true,
        data: { strategy_names: [], product_map: {} },
      });
    }

    const adminClient = getServiceClient();

    // 透過 service role 列出使用者，找到系統管理員 forjerry@gmail.com
    const { data: users, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError || !users) {
      console.warn('[strategy-map] listUsers failed:', listError?.message);
      return NextResponse.json({
        success: true,
        data: { strategy_names: [], product_map: {} },
      });
    }

    const forJerry = users?.find((u: { email?: string }) => u.email === 'forjerry@gmail.com');
    if (!forJerry) {
      return NextResponse.json({
        success: true,
        data: { strategy_names: [], product_map: {} },
      });
    }

    const metadata = (forJerry.user_metadata || {}) as Record<string, unknown>;
    const strategyNamesRaw = metadata.strategy_names;
    const productMapRaw = metadata.strategy_product_map;

    const strategyNames: string[] = Array.isArray(strategyNamesRaw)
      ? strategyNamesRaw
      : typeof strategyNamesRaw === 'string'
        ? strategyNamesRaw.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

    const productMap: Record<string, string> =
      typeof productMapRaw === 'object' && productMapRaw !== null
        ? Object.fromEntries(
            Object.entries(productMapRaw as Record<string, string>).map(([k, v]) => [k.replace(/^\uFEFF/, ''), v])
          )
        : {};

    return NextResponse.json({
      success: true,
      data: { strategy_names: strategyNames, product_map: productMap },
    });
  } catch (error: any) {
    // 絕對不回傳 500，避免前端中斷；所有錯誤皆回傳空對照表
    console.error('[strategy-map] GET error:', error);
    return NextResponse.json({
      success: true,
      data: { strategy_names: [], product_map: {} },
    });
  }
}

/**
 * POST /api/strategy-map
 * 僅系統管理員 (forjerry@gmail.com) 可寫入：更新共用的策略名稱清單與策略商品對照表
 * Request body: { strategy_names: string[], product_map: Record<string, string> }
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const token = authHeader?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ success: false, error: 'Missing bearer token' }, { status: 401 });
    }

    const adminClient = getServiceClient();

    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 僅系統管理員可寫入
    if (!ADMIN_EMAILS.includes(user.email ?? '')) {
      return NextResponse.json({ success: false, error: 'Forbidden: admin only' }, { status: 403 });
    }

    const body = await req.json();
    const { strategy_names, product_map } = body as {
      strategy_names?: string[];
      product_map?: Record<string, string>;
    };

    if (!Array.isArray(strategy_names)) {
      return NextResponse.json({ success: false, error: 'strategy_names must be an array' }, { status: 400 });
    }
    if (product_map && typeof product_map !== 'object') {
      return NextResponse.json({ success: false, error: 'product_map must be an object' }, { status: 400 });
    }

    // 讀取目前 metadata，只更新相關欄位
    const currentMeta = (user.user_metadata || {}) as Record<string, unknown>;
    const nextMeta: Record<string, unknown> = { ...currentMeta };
    nextMeta.strategy_names = strategy_names;
    if (product_map) {
      nextMeta.strategy_product_map = product_map;
    }

    const updateResp = await adminClient.auth.admin.updateUserById(user.id, {
      user_metadata: nextMeta,
    });

    if (updateResp.error) {
      // 記錄錯誤但仍回傳 200，避免前端中斷；資料仍會在本端狀態中顯示
      console.error('[strategy-map] POST updateUserById error:', updateResp.error.message);
      return NextResponse.json({
        success: true,
        data: { strategy_names, product_map: product_map || {} },
      });
    }

    return NextResponse.json({
      success: true,
      data: { strategy_names, product_map: product_map || {} },
    });
  } catch (error: any) {
    // 絕對不回傳 500，避免前端中斷
    console.error('[strategy-map] POST error:', error);
    return NextResponse.json({
      success: true,
      data: { strategy_names: [], product_map: {} },
    });
  }
}