import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  try {
    const email = 'forjerry.cell@gmail.com';
    const password = 'Diegod@10867';

    // 1. 建立帳號
    const { data: userData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) {
      if (authError.message.includes('already exists')) {
         return NextResponse.json({ message: '帳號已存在，請直接登入。若密碼不符，請聯繫系統重設。' });
      }
      throw authError;
    }

    // 2. 提升為管理員
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ 
        id: userData.user.id, 
        full_name: 'Jerry Admin', 
        is_admin: true 
      });

    if (profileError) throw profileError;

    return NextResponse.json({ message: '管理員帳號核發成功！您現在可以去登入了。' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
