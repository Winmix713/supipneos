import { describe, expect, it } from 'vitest';
import { resolveCloudEnv, readCloudEnv } from '../utils/cloudConfig';

const URL = 'https://yvwnchyedxkajtwwkkqd.supabase.co';

describe('cloudConfig — kizárólagos WinMix-projekt konfiguráció', () => {
  it('elfogadja a kijelölt WinMix URL-t és levágja a záró perjelet', () => {
    expect(
      resolveCloudEnv({ VITE_SUPABASE_URL: ` ${URL}/ `, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_winmix' }),
    ).toEqual({
      url: URL,
      anonKey: 'sb_publishable_winmix',
      source: 'env',
    });
  });

  it('elfogadja a történeti VITE_SUPABASE_ANON_KEY nevet is', () => {
    const env = resolveCloudEnv(
      {
        VITE_SUPABASE_URL: URL,
        VITE_SUPABASE_PUBLISHABLE_KEY: '',
        VITE_SUPABASE_ANON_KEY: 'legacy-jwt-key',
      },
    );
    expect(env).toMatchObject({ anonKey: 'legacy-jwt-key', source: 'env' });
  });

  it.each([
    ['hiányzó séma', 'yvwnchyedxkajtwwkkqd.supabase.co'],
    ['üres URL', ''],
    ['szemét', 'nem-egy-url'],
    ['másik Supabase projekt', 'https://other.example.supabase.co'],
  ])('érvénytelen vagy idegen URL (%s) → unconfigured', (_label, url) => {
    expect(resolveCloudEnv({ VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: 'valami' })).toBeNull();
  });

  it('üres kulcs → unconfigured', () => {
    expect(
      resolveCloudEnv(
        {
          VITE_SUPABASE_URL: URL,
          VITE_SUPABASE_PUBLISHABLE_KEY: '   ',
          VITE_SUPABASE_ANON_KEY: '',
        },
      ),
    ).toBeNull();
  });

  it('elutasítja a service-role JWT-t és az opaque secret kulcsot', () => {
    const serviceRoleJwt = `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ role: 'service_role' }))}.signature`;
    expect(resolveCloudEnv({ VITE_SUPABASE_URL: URL, VITE_SUPABASE_ANON_KEY: serviceRoleJwt })).toBeNull();
    expect(resolveCloudEnv({ VITE_SUPABASE_URL: URL, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_not_allowed' })).toBeNull();
  });

  it('explicit környezeti konfiguráció nélkül unconfigured', () => {
    expect(resolveCloudEnv({})).toBeNull();
  });

  it('a feloldott konfiguráció a session alatt stabil és fagyasztott (cache)', () => {
    const first = readCloudEnv();
    expect(readCloudEnv()).toBe(first);
    if (first) expect(Object.isFrozen(first)).toBe(true);
  });
});
