import {parseSupabaseConfig} from './supabase/config';

type Environment = Record<string, string | undefined>;
type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export async function verifyDeployment(env: Environment, fetcher: Fetcher = fetch) {
  if (env.LEDGER_DASHBOARD_TEST) throw new Error('Test mode must be disabled for deployment.');
  const config = parseSupabaseConfig(env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!config) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY before deploying.');
  const url = new URL(config.url);
  if (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Deployment requires a remote HTTPS Supabase project.');
  let response: Response;
  try {
    response = await fetcher(config.url + '/auth/v1/settings', {headers: {apikey: config.key}, signal: AbortSignal.timeout(10_000), cache: 'no-store'});
  } catch { throw new Error('Cannot verify Supabase Auth settings. Check the project connection and retry.'); }
  if (!response.ok) throw new Error('Supabase Auth settings could not be verified. Check the project URL and public key.');
  const settings = await response.json();
  if (settings.disable_signup !== true) throw new Error('Disable public signups in Supabase Authentication before deploying.');
  if (settings.external?.anonymous_users !== false) throw new Error('Disable anonymous sign-ins in Supabase Authentication before deploying.');
}
