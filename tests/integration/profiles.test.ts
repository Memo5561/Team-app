import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  adminClient,
  cleanUp,
  createConfirmedUser,
  publicClient,
  signedInClient,
  type Client,
  type TestAccount,
} from './support/supabase';

// Tenant isolation of `profiles` through the real API (PostgREST + JWT + RLS), complementing the
// pgTAP tests in supabase/tests/database/010_profiles.test.sql. Phase 1 grants SELECT only:
// every user sees exactly their own row, nobody can write, anonymous requests get nothing.

const PERMISSION_DENIED = '42501';

let anna: TestAccount;
let bert: TestAccount;
let annaClient: Client;
const emails = new Set<string>();

beforeAll(async () => {
  anna = await createConfirmedUser('Anna Integration');
  bert = await createConfirmedUser('Bert Integration');
  emails.add(anna.email).add(bert.email);
  annaClient = await signedInClient(anna);
});

afterAll(async () => {
  await cleanUp(emails);
});

async function displayNameOf(userId: string): Promise<string | undefined> {
  const { data, error } = await adminClient()
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle();
  expect(error).toBeNull();
  return data?.display_name;
}

describe('profiles via the API', () => {
  it('a user sees exactly their own profile', async () => {
    const { data, error } = await annaClient.from('profiles').select('id, display_name, locale');

    expect(error).toBeNull();
    expect(data).toEqual([{ id: anna.id, display_name: 'Anna Integration', locale: 'de' }]);
  });

  it("a user cannot read someone else's profile, even by id", async () => {
    const { data, error } = await annaClient.from('profiles').select('id').eq('id', bert.id);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('a user cannot change profiles, neither their own nor others', async () => {
    for (const target of [anna, bert]) {
      const { error } = await annaClient
        .from('profiles')
        .update({ display_name: 'Gehackt' })
        .eq('id', target.id);

      expect(error?.code).toBe(PERMISSION_DENIED);
    }
    expect(await displayNameOf(anna.id)).toBe('Anna Integration');
    expect(await displayNameOf(bert.id)).toBe('Bert Integration');
  });

  it('a user cannot create or delete profiles', async () => {
    const insert = await annaClient
      .from('profiles')
      .insert({ id: bert.id, display_name: 'Doppelt' })
      .select();
    expect(insert.error?.code).toBe(PERMISSION_DENIED);

    const remove = await annaClient.from('profiles').delete().eq('id', bert.id);
    expect(remove.error?.code).toBe(PERMISSION_DENIED);
    expect(await displayNameOf(bert.id)).toBe('Bert Integration');
  });

  it('anonymous requests get no profiles', async () => {
    const { data, error } = await publicClient().from('profiles').select('id');

    expect(data ?? []).toEqual([]);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it('deleting the auth user deletes the profile', async () => {
    const carla = await createConfirmedUser('Carla Cascade');
    expect(await displayNameOf(carla.id)).toBe('Carla Cascade');

    const { error } = await adminClient().auth.admin.deleteUser(carla.id);

    expect(error).toBeNull();
    expect(await displayNameOf(carla.id)).toBeUndefined();
  });
});
