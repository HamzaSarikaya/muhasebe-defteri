export type SupabaseConfig = {url: string; key: string};

export function parseSupabaseConfig(url?: string, key?: string): SupabaseConfig | null {
  const cleanUrl = url?.trim();
  const cleanKey = key?.trim();
  if (!cleanUrl && !cleanKey) return null;
  if (!cleanUrl || !cleanKey) throw new Error('Supabase URL and publishable key must be configured together.');
  const parsed = new URL(cleanUrl);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) {
    throw new Error('Supabase requires HTTPS (except local development).');
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
    throw new Error('Supabase URL must be a project origin.');
  }
  if (!cleanKey.startsWith('sb_publishable_')) {
    // Legacy anon JWTs are supported, but privileged keys must never enter a browser client.
    let role: unknown;
    try {
      const payload = cleanKey.split('.')[1];
      role = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).role;
    } catch {
      throw new Error('Use a Supabase publishable key or legacy anon key.');
    }
    if (role !== 'anon') throw new Error('Only public Supabase keys are allowed.');
  }
  return {url: parsed.origin, key: cleanKey};
}

export function getSupabaseConfig() {
  return parseSupabaseConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function isSupabaseConfigured() { return getSupabaseConfig() !== null; }

export function requireSupabaseConfig() {
  const config = getSupabaseConfig();
  if (!config) throw new Error('Supabase is not configured. See .env.example.');
  return config;
}
