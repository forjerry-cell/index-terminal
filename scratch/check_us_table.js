const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkTable() {
  console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  // 我們只印出 key 的前 10 和後 10 個字元來保護隱私並做驗證
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (key) {
    console.log('SERVICE_KEY:', key.substring(0, 15) + '...' + key.substring(key.length - 15));
  } else {
    console.log('SERVICE_KEY: undefined');
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('\n--- 嘗試查詢 alphafalcon_us_daily_results 表 ---');
  const { data, error } = await supabase
    .from('alphafalcon_us_daily_results')
    .select('scan_date')
    .limit(1);

  if (error) {
    console.error('查詢失敗，詳細錯誤訊息如下:');
    console.error(JSON.stringify(error, null, 2));
  } else {
    console.log('查詢成功！表確實存在且連線無誤。');
    console.log('返回數據數:', data.length);
  }
}

checkTable();
