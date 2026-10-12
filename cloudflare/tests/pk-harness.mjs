import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
export async function arenaRuntime({ origin = 'https://wwwne1198.party', port } = {}) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const compiled = await build({ entryPoints: [root + 'worker.js'], bundle: true, format:'esm', write:false, platform:'browser', target:'es2022' });
  const mf = new Miniflare(convertV4MiniflareOptions({ modules:true, script:compiled.outputFiles[0].text, compatibilityDate:'2026-10-01', host:'127.0.0.1', ...(port ? { port } : {}),
    bindings:{ ALLOWED_ORIGINS:origin, API_ENABLED:'true', PK_ENABLED:'true', TURNSTILE_SECRET:'local-test-only', IP_HASH_SECRET:'local-test-only-'.repeat(4) },
    durableObjects:{ PK_ARENA:{ className:'PKArena', useSQLite:true } }, d1Databases:['DB'], r2Buckets:['IMAGES'],
    ratelimits:{ API_RATE_LIMITER:{namespace_id:'1001',simple:{limit:20,period:60}}, PK_RATE_LIMITER:{namespace_id:'1002',simple:{limit:12,period:60}} },
    outboundService:async request => {
      assert.equal(new URL(request.url).hostname,'challenges.cloudflare.com');
      const input=await request.json();return Response.json({ success:input.response!=='bad',hostname:new URL(origin).hostname,action:input.response });
    },
  }));
  const db=await mf.getD1Database('DB');
  const migration=await readFile(root+'migrations/0001_profiles.sql','utf8');
  for(const sql of migration.match(/\s*CREATE TRIGGER[\s\S]*?END;|[^;]+;/g)) await db.prepare(sql).run();
  return mf;
}
