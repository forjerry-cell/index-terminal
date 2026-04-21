import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { action, userId, email, password, fullName } = await req.json();

  try {
    if (action === 'LOGOUT_USER') {
      const { error } = await supabaseAdmin.auth.admin.signOut(userId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'CREATE_USER') {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        user_metadata: { full_name: fullName },
        email_confirm: true
      });
      if (error) throw error;
      return NextResponse.json({ success: true, user: data.user });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
