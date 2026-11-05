import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseSupabaseConfig} from '../lib/supabase/config';
import tr from '../messages/tr.json';
import en from '../messages/en.json';

const jwt = (role: string) => `header.${Buffer.from(JSON.stringify({role})).toString('base64url')}.signature`;

test('missing credentials leave the shell usable, partial configuration fails clearly', () => {
  assert.equal(parseSupabaseConfig(), null);
  assert.throws(() => parseSupabaseConfig('https://example.supabase.co'));
  assert.throws(() => parseSupabaseConfig(undefined, 'sb_publishable_example'));
});

test('public keys and local Supabase origins are supported', () => {
  assert.deepEqual(parseSupabaseConfig(' https://example.supabase.co/ ', ' sb_publishable_example '), {url: 'https://example.supabase.co', key: 'sb_publishable_example'});
  assert.equal(parseSupabaseConfig('http://127.0.0.1:54321', jwt('anon'))?.url, 'http://127.0.0.1:54321');
});

test('privileged keys, insecure remote URLs and non-origin URLs are rejected', () => {
  for (const key of ['sb_secret_example', jwt('service_role'), 'invalid']) {
    assert.throws(() => parseSupabaseConfig('https://example.supabase.co', key));
  }
  for (const url of ['http://example.com', 'https://user:password@example.com', 'https://example.com/auth', 'https://example.com?key=1', 'https://example.com#key']) {
    assert.throws(() => parseSupabaseConfig(url, 'sb_publishable_example'));
  }
});

test('all translation keys are present in both languages', () => {
  function keys(value: object, prefix = ''): string[] {
    return Object.entries(value).flatMap(([key, child]) => typeof child === 'object' && child !== null ? keys(child, `${prefix}${key}.`) : [`${prefix}${key}`]).sort();
  }
  assert.deepEqual(keys(tr), keys(en));
});
