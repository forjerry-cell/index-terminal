import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * 一次性初始化 API：
 * 1. 確保 taiwan_momentum_30 存在於 indices 表
 * 2. 將 public/taiwan_momentum_30.json 遷移至 Supabase
 *
 * 呼叫方式: GET /api/init-momentum-index
 */

export async function GET() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json(
            { error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' },
            { status: 500 }
        );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false }
    });

    const results: string[] = [];

    try {
        // 1. 確保指數定義存在
        const { error: idxError } = await supabase
            .from('indices')
            .upsert({
                id: 'taiwan_momentum_30',
                name: '台股強勢動能指數',
                description: '每半年定期再平衡，以台灣高波動指數官方50檔成分股為母體，依126日動能取前30檔',
            }, { onConflict: 'id' });

        if (idxError) {
            results.push(`indices upsert failed: ${idxError.message}`);
        } else {
            results.push('indices: taiwan_momentum_30 ensured');
        }

        // 2. 讀取 JSON 並遷移
        const jsonPath = join(process.cwd(), 'public', 'taiwan_momentum_30.json');
        let data;
        try {
            data = JSON.parse(readFileSync(jsonPath, 'utf-8'));
        } catch {
            return NextResponse.json({ error: 'taiwan_momentum_30.json not found', results }, { status: 404 });
        }

        const perf = data.performance || [];
        const constituents = data.constituents || [];
        const rebalanceHistory = data.rebalance_history || [];
        const today = new Date().toISOString().split('T')[0];

        // 3. 遷移績效數據
        const perfRows = perf.map((row: any) => ({
            index_id: 'taiwan_momentum_30',
            date: row.date,
            value: row.value,
            change_percent: row.change_percent ?? 0,
            benchmark_value: row.benchmark_value ?? null,
        }));

        // 分批上傳
        for (let i = 0; i < perfRows.length; i += 200) {
            const batch = perfRows.slice(i, i + 200);
            const { error } = await supabase
                .from('index_performance')
                .upsert(batch, { onConflict: 'index_id,date' });
            if (error) {
                results.push(`performance batch ${i}: ${error.message}`);
            }
        }
        results.push(`performance: ${perfRows.length} rows migrated`);

        // 4. 遷移成分股
        const constRows = constituents.map((c: any) => ({
            index_id: 'taiwan_momentum_30',
            symbol: String(c.symbol).trim(),
            name: c.name || String(c.symbol).trim(),
            weight: c.weight ?? 0,
            date: c.date || today,
        }));

        if (constRows.length > 0) {
            const { error } = await supabase
                .from('index_constituents')
                .upsert(constRows, { onConflict: 'index_id,symbol,date' });
            if (error) {
                results.push(`constituents: ${error.message}`);
            } else {
                results.push(`constituents: ${constRows.length} rows migrated`);
            }
        }

        // 5. 遷移換股歷史
        if (rebalanceHistory.length > 0) {
            const histRows = rebalanceHistory.map((h: any) => ({
                index_id: 'taiwan_momentum_30',
                term: h.term || '',
                effective_date: h.effective_date || today,
                retained_count: h.retained_count ?? 0,
                added_stocks: h.added_stocks || [],
                removed_stocks: h.removed_stocks || [],
            }));
            const { error } = await supabase
                .from('rebalance_history')
                .upsert(histRows, { onConflict: 'index_id,term' });
            if (error) {
                results.push(`rebalance_history: ${error.message}`);
            } else {
                results.push(`rebalance_history: ${histRows.length} rows migrated`);
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Migration complete',
            results,
        });
    } catch (err: any) {
        return NextResponse.json(
            { error: err.message, results },
            { status: 500 }
        );
    }
}
