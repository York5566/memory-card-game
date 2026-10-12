// Local-only emulator: no Cloudflare account traffic, no production Turnstile bypass.
import { arenaRuntime } from '../cloudflare/tests/pk-harness.mjs';
const port = Number(process.env.PORT || 4185), apiPort = Number(process.env.PK_PORT || 8795);
const mf = await arenaRuntime({ origin: `http://127.0.0.1:${port}`, port: apiPort });
await mf.ready;
process.env.PK_LOCAL_API = `http://127.0.0.1:${apiPort}`;
process.env.PORT = String(port);
await import('./serve.mjs');
console.log(`Local PK API: ${process.env.PK_LOCAL_API} (isolated D1/R2/SQLite emulators)`);
const stop = async () => { await mf.dispose(); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
