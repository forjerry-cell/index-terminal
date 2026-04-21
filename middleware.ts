import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // 緊急解鎖：直接放行所有請求
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/admin/:path*', '/profile/:path*', '/login'],
};
