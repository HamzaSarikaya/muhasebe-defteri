import 'server-only';
import {cache} from 'react';
import {isSupabaseConfigured} from '@/lib/supabase/config';
import {createClient} from '@/lib/supabase/server';
import type {Ledger} from './ledger';

export const readLedger = cache(async () => {
  if (!isSupabaseConfigured()) return {state: 'setup' as const};
  const db = await createClient();
  const {data: identity, error} = await db.auth.getClaims();
  const owner = identity?.claims.sub;
  if (!owner) {
    if (error && error.name !== 'AuthSessionMissingError' && ![400, 401, 403].includes(error.status ?? 0)) throw error;
    return {state: 'login' as const};
  }
  const {data, error: snapshotError} = await db.rpc('ledger_snapshot');
  if (snapshotError || !data) throw new Error('Ledger unavailable');
  return {state: 'ready' as const, data: data as Ledger, owner};
});
