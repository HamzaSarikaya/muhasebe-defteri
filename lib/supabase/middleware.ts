import {createServerClient} from '@supabase/ssr';
import type {NextRequest, NextResponse} from 'next/server';
import {getSupabaseConfig} from './config';

export async function updateSession(request: NextRequest, response: NextResponse) {
  const config = getSupabaseConfig();
  // The Phase 1 shell works without credentials; it never serves account data.
  if (!config) return response;
  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({name, value, options}) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
        // Preserve next-intl's rewrite and locale header while forwarding refreshed cookies.
        const overrides = new Set((response.headers.get('x-middleware-override-headers') ?? '').split(',').filter(Boolean));
        overrides.add('cookie');
        response.headers.set('x-middleware-override-headers', [...overrides].join(','));
        response.headers.set('x-middleware-request-cookie', request.cookies.toString());
      }
    }
  });
  // Refresh tokens here. Ledger reads and writes independently verify the user.
  await supabase.auth.getClaims();
  return response;
}
