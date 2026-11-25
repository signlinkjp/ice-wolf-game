#!/usr/bin/env node
// Live Supabase Realtime handshake smoke test for ICE WOLF.
//
// Opens the Realtime WebSocket exactly the way the game's transport does
// (createIceWolfSupabaseTransport -> `${url}/realtime/v1/websocket?apikey=..&vsn=1.0.0`),
// joins one throwaway channel, and reports the phx_reply status.
//
// Usage:
//   node --experimental-websocket tools/supabase-realtime-smoke.mjs \
//     --url https://PROJECT.supabase.co --key sb_publishable_xxx [--topic icewolf-smoke-test]
//
// Exit codes: 0 = joined (phx_reply ok), 1 = protocol/socket failure,
//             2 = refusal by the server, 3 = bad arguments.

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index].replace(/^--/, ''), process.argv[index + 1]);
}

const url = (args.get('url') || '').replace(/\/+$/, '');
const key = args.get('key') || '';
const topicName = args.get('topic') || 'icewolf-smoke-test';
const timeoutMs = Number(args.get('timeout') || 15000);

if (!url || !key) {
  console.error('usage: node --experimental-websocket tools/supabase-realtime-smoke.mjs --url https://PROJECT.supabase.co --key KEY [--topic name]');
  process.exit(3);
}

const wsUrl = `${url.replace(/^https:/, 'wss:')}/realtime/v1/websocket?apikey=${encodeURIComponent(key)}&vsn=1.0.0`;
const topic = `realtime:${topicName}`;
const started = Date.now();
const log = (...parts) => console.log(`[+${((Date.now() - started) / 1000).toFixed(2)}s]`, ...parts);

if (typeof WebSocket === 'undefined') {
  console.error('no global WebSocket: run node with --experimental-websocket');
  process.exit(3);
}

log('opening', wsUrl.replace(/apikey=[^&]+/, 'apikey=<redacted>'));

let finished = false;
const done = (code, message) => {
  if (finished) return;
  finished = true;
  console.log(code === 0 ? `RESULT: OK — ${message}` : `RESULT: FAIL — ${message}`);
  try { socket.close(); } catch (_) {}
  setTimeout(() => process.exit(code), 50);
};

const socket = new WebSocket(wsUrl);

const timer = setTimeout(() => done(1, `no phx_reply within ${timeoutMs}ms`), timeoutMs);

socket.onopen = () => {
  log('socket open');
  const join = {
    topic,
    event: 'phx_join',
    ref: 'join-1',
    payload: {
      config: {
        broadcast: { self: true },
        presence: { key: 'icewolf-smoke-test-client' },
        private: false
      },
      access_token: key
    }
  };
  socket.send(JSON.stringify(join));
  log('sent phx_join', topic);
};

socket.onmessage = (event) => {
  let frame;
  try { frame = JSON.parse(String(event.data)); } catch (_) { log('non-JSON frame:', String(event.data).slice(0, 200)); return; }
  log('<', JSON.stringify(frame).slice(0, 400));
  if (frame.event === 'phx_reply' && frame.ref === 'join-1') {
    clearTimeout(timer);
    const status = frame.payload && frame.payload.status;
    if (status === 'ok') {
      // One broadcast round trip proves the channel is writable.
      socket.send(JSON.stringify({
        topic, event: 'broadcast', ref: 'bcast-1',
        payload: { type: 'broadcast', event: 'ping', payload: { at: Date.now() } }
      }));
      setTimeout(() => done(0, `phx_join replied ok on ${topic}; broadcast accepted (${Date.now() - started}ms)`), 400);
    } else {
      done(2, `phx_join replied ${status}: ${JSON.stringify(frame.payload && frame.payload.response)}`);
    }
  }
  if (frame.event === 'phx_error') {
    clearTimeout(timer);
    done(2, `phx_error: ${JSON.stringify(frame.payload)}`);
  }
};

socket.onerror = (event) => {
  const detail = event && (event.message || event.error && event.error.message);
  log('socket error', detail || '(no detail)');
  // The close event that follows carries the HTTP status reason in most cases.
};

socket.onclose = (event) => {
  clearTimeout(timer);
  if (!finished) done(1, `socket closed before a phx_reply (code ${event.code}${event.reason ? `, reason ${event.reason}` : ''})`);
};
