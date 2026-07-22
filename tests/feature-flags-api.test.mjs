import test from 'node:test';
import assert from 'node:assert/strict';
import featureFlagsFunction from '../netlify/functions/feature-flags.mjs';
import { FEATURE_FLAG_IDS } from '../netlify/functions/lib/feature-flags.mjs';

test('feature-flags GET returns a full flag document', async () => {
  const res = await featureFlagsFunction(new Request('http://localhost:8888/api/feature-flags'));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(Object.keys(data.flags).length, FEATURE_FLAG_IDS.length);
  assert.ok(['db', 'blob', 'bundled'].includes(data.source));
});

test('feature-flags POST rejects non-admin callers', async () => {
  const res = await featureFlagsFunction(new Request('http://localhost:8888/api/feature-flags', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Host': 'localhost:8888',
      'Origin': 'http://localhost:8888',
    },
    body: JSON.stringify({ flags: { ai: { everyone: true, admin: true } } }),
  }));
  assert.equal(res.status, 403);
});

test('feature-flags POST saves with localhost admin secret', async (t) => {
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    t.skip('Netlify Blobs/Database not available on Vercel static builds');
    return;
  }

  const prev = process.env.TINYWORLD_ADMIN_SECRET;
  process.env.TINYWORLD_ADMIN_SECRET = 'test-feature-flags-secret';
  try {
    const res = await featureFlagsFunction(new Request('http://localhost:8888/api/feature-flags', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Host': 'localhost:8888',
        'Origin': 'http://localhost:8888',
        'x-admin-secret': 'test-feature-flags-secret',
      },
      body: JSON.stringify({
        flags: {
          ai: { everyone: false, admin: true },
          playerSearch: { everyone: false, admin: false },
        },
      }),
    }));
    const data = await res.json();
    assert.equal(res.status, 200, JSON.stringify(data));
    assert.equal(data.ok, true);
    assert.equal(data.flags.ai.everyone, false);
    assert.equal(data.flags.playerSearch.everyone, false);
    assert.equal(data.flags.playerSearch.admin, false);
    assert.ok(['db', 'blob'].includes(data.source));
  } finally {
    if (prev == null) delete process.env.TINYWORLD_ADMIN_SECRET;
    else process.env.TINYWORLD_ADMIN_SECRET = prev;
  }
});
