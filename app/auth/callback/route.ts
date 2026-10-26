import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const code = new URL(request.url).searchParams.get('code');
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL('/account', origin));
  }
  return NextResponse.redirect(new URL('/login?error=oauth', origin));
}
