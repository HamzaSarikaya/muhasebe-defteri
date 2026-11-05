import createMiddleware from 'next-intl/middleware';
import type {NextRequest} from 'next/server';
import {routing} from '@/i18n/routing';
import {updateSession} from '@/lib/supabase/middleware';

const handleI18n = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const response = await updateSession(request, handleI18n(request));
  // Private financial pages must not be stored by browsers or shared caches.
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}

export const config = {matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']};
