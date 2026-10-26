import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

type CookieUpdate = {
  name: string;
  value: string;
  options?: {
    domain?: string;
    path?: string;
    expires?: Date;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: boolean | 'lax' | 'strict' | 'none';
    maxAge?: number;
    priority?: 'low' | 'medium' | 'high';
    partitioned?: boolean;
  };
};

export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase environment variables are missing.');
  return createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(items: CookieUpdate[]) {
        try { items.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
        catch { /* Server Components cannot set cookies; proxy handles refresh. */ }
      },
    },
  });
}
