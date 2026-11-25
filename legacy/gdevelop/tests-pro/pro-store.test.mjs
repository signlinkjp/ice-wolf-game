// The StoreKit bridge: what the app does with each answer the native plugin can
// give (bought, cancelled, deferred, failed, restored, nothing, no plugin at
// all, a promise that never settles) and what it remembers between launches.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadProCode, memoryStorage } from './helpers.mjs';

const makeStore = (options = {}) => {
  const { createIceWolfProStore, ICE_WOLF_PRO_PRODUCT_ID } = loadProCode();
  const storage = options.storage || memoryStorage();
  const seen = [];
  const store = createIceWolfProStore({
    productId: ICE_WOLF_PRO_PRODUCT_ID,
    storage,
    timeoutMs: options.timeoutMs || 50,
    now: options.now || (() => 1000),
    getAdapter: options.getAdapter,
    onUpdate: (snapshot) => seen.push(snapshot)
  });
  return { store, storage, seen, productId: ICE_WOLF_PRO_PRODUCT_ID };
};

const adapter = (methods) => ({
  proStatus: async () => ({ supported: true, priceText: '¥500', pro: false }),
  purchase: async () => ({ result: 'purchased', pro: true, transactionId: 'tx-1' }),
  restore: async () => ({ result: 'restored', pro: true, productIds: ['jp.signlink.IceWolf.pro'] }),
  ...methods
});

test('the store asks for the one non-consumable product', async () => {
  const { store, productId } = makeStore({ getAdapter: () => adapter() });
  assert.equal(store.productId, 'jp.signlink.IceWolf.pro');
  assert.equal(store.snapshot().productId, productId);
  const state = await store.refresh();
  assert.equal(state.status, 'ready');
  assert.equal(state.available, true);
  assert.equal(state.priceText, '¥500');
  assert.equal(state.pro, false);
  assert.equal(state.ready, true);
  assert.equal(state.checkedAt, 1000);
});

test('without the native plugin the screen still works and says where to buy', async () => {
  const { store, seen } = makeStore({ getAdapter: () => null });
  store.hydrate();
  const state = await store.refresh();
  assert.equal(state.available, false);
  assert.equal(state.status, 'unavailable');
  assert.equal(state.message, 'pro.storeUnavailable');
  assert.equal(state.pro, false);
  const bought = await store.purchase();
  assert.equal(bought.status, 'unavailable', 'pressing purchase does not throw and does not unlock');
  assert.equal(bought.pro, false);
  const restored = await store.restore();
  assert.equal(restored.status, 'unavailable');
  assert.ok(seen.length >= 3, 'the screen is told about every change');
});

test('purchasing unlocks Pro once and remembers the transaction', async () => {
  const { store, storage } = makeStore({ getAdapter: () => adapter() });
  await store.refresh();
  const state = await store.purchase();
  assert.equal(state.status, 'purchased');
  assert.equal(state.message, 'pro.thanks');
  assert.equal(state.pro, true);
  assert.equal(state.purchaseCount, 1);
  assert.equal(state.source, 'purchase');
  assert.equal(state.transactionId, 'tx-1');
  assert.equal(state.busy, false);
  const saved = JSON.parse(storage.getItem('iceWolfProV1'));
  assert.equal(saved.pro, true, 'the entitlement is cached for the next launch');
  assert.equal(saved.productId, 'jp.signlink.IceWolf.pro');
  const again = await store.purchase();
  assert.equal(again.purchaseCount, 1, 'Pro is not bought twice');
});

test('a cached entitlement paints Pro before StoreKit answers, and the store still wins', async () => {
  const storage = memoryStorage({ iceWolfProV1: JSON.stringify({ pro: true, transactionId: 'tx-old', checkedAt: 500 }) });
  const { store } = makeStore({ storage, getAdapter: () => null });
  const cached = store.hydrate();
  assert.equal(cached.pro, true);
  assert.equal(cached.source, 'cache');
  assert.equal(cached.transactionId, 'tx-old');

  // the store now says the product is not owned (refunded): the store wins
  const refunded = makeStore({
    storage,
    getAdapter: () => adapter({ proStatus: async () => ({ supported: true, priceText: '¥500', pro: false }) })
  });
  refunded.store.hydrate();
  const state = await refunded.store.refresh();
  assert.equal(state.pro, false, 'a refund is followed');
  assert.equal(JSON.parse(storage.getItem('iceWolfProV1')).pro, false, 'and the cache is corrected');
});

test('cancelled and deferred purchases stay locked but are reported', async () => {
  const cancelled = makeStore({ getAdapter: () => adapter({ purchase: async () => ({ result: 'cancelled', pro: false }) }) });
  const state = await cancelled.store.purchase();
  assert.equal(state.status, 'cancelled');
  assert.equal(state.message, 'pro.cancelled');
  assert.equal(state.pro, false);
  assert.equal(state.purchaseCount, 0);

  const pending = makeStore({ getAdapter: () => adapter({ purchase: async () => ({ result: 'pending', pro: false }) }) });
  const deferred = await pending.store.purchase();
  assert.equal(deferred.status, 'pending');
  assert.equal(deferred.message, 'pro.pending');
  assert.equal(deferred.pro, false);
  assert.equal(deferred.busy, false, 'the button comes back while approval is pending');
});

test('a rejected call, a thrown call and a silent call all end as a failure, never as a crash', async () => {
  const rejected = makeStore({ getAdapter: () => adapter({ purchase: async () => { throw new Error('SKError 0'); } }) });
  const first = await rejected.store.purchase();
  assert.equal(first.status, 'failed');
  assert.equal(first.message, 'pro.failed');
  assert.equal(first.pro, false);
  assert.ok(first.lastError.includes('SKError'), `the reason is kept: ${first.lastError}`);

  const thrown = makeStore({ getAdapter: () => adapter({ purchase: () => { throw new Error('sync boom'); } }) });
  const second = await thrown.store.purchase();
  assert.equal(second.status, 'failed');
  assert.equal(second.pro, false);

  const silent = makeStore({ getAdapter: () => adapter({ purchase: () => new Promise(() => {}) }), timeoutMs: 20 });
  const third = await silent.store.purchase();
  assert.equal(third.status, 'failed');
  assert.equal(third.lastError, 'timeout');
  assert.equal(third.pro, false);
  assert.equal(third.busy, false, 'a hung call releases the button');
});

test('restore reports restored and nothing-to-restore separately', async () => {
  const restored = makeStore({ getAdapter: () => adapter() });
  const state = await restored.store.restore();
  assert.equal(state.status, 'restored');
  assert.equal(state.message, 'pro.restored');
  assert.equal(state.pro, true);
  assert.equal(state.restoreCount, 1);
  assert.equal(state.source, 'restore');

  const empty = makeStore({ getAdapter: () => adapter({ restore: async () => ({ result: 'none', pro: false, productIds: [] }) }) });
  const nothing = await empty.store.restore();
  assert.equal(nothing.status, 'nothing');
  assert.equal(nothing.message, 'pro.nothingToRestore');
  assert.equal(nothing.pro, false);
});

test('the answers are read loosely (status/result, camelCase, booleans as strings)', async () => {
  const { createIceWolfProStore } = loadProCode();
  const store = createIceWolfProStore({
    timeoutMs: 50,
    storage: memoryStorage(),
    getAdapter: () => ({
      proStatus: async () => ({ supported: true, priceText: 'US$4.99', pro: 'true' }),
      purchase: async () => ({ status: 'PURCHASED', pro: true }),
      restore: async () => ({ result: 'restored', pro: true })
    })
  });
  const status = await store.refresh();
  assert.equal(status.pro, true, 'a string "true" from the native side counts as owned');
  const bought = await store.purchase();
  assert.equal(bought.status, 'ready', 'nothing to buy when the store already says owned');
  assert.equal(bought.purchaseCount, 0);
  assert.equal(status.priceText, 'US$4.99');
});

test('a synchronous test adapter settles the whole purchase in one call', async () => {
  const { createIceWolfProStore, createIceWolfProFakeAdapter } = loadProCode();
  const calls = [];
  const store = createIceWolfProStore({
    storage: memoryStorage(),
    getAdapter: () => createIceWolfProFakeAdapter('ok', { priceText: '¥500' }),
    onUpdate: (snapshot) => calls.push(snapshot.status)
  });
  await store.refresh();
  const state = await store.purchase();
  assert.equal(state.pro, true, 'the fake answers without a tick, so one frame is enough in the game test');
  assert.ok(calls.includes('purchasing'), 'the screen shows the working state first');
});

test('the fake adapter covers the states the game test drives', async () => {
  const { createIceWolfProStore, createIceWolfProFakeAdapter } = loadProCode();
  const run = async (mode) => {
    const store = createIceWolfProStore({
      storage: memoryStorage(),
      timeoutMs: 20,
      getAdapter: () => createIceWolfProFakeAdapter(mode, { priceText: '¥500' })
    });
    await store.refresh();
    return mode === 'restoreNone' || mode === 'restore' ? store.restore() : store.purchase();
  };
  assert.equal((await run('ok')).status, 'purchased');
  assert.equal((await run('cancel')).status, 'cancelled');
  assert.equal((await run('pending')).status, 'pending');
  assert.equal((await run('fail')).status, 'failed');
  assert.equal((await run('throw')).status, 'failed');
  assert.equal((await run('slow')).lastError, 'timeout');
  assert.equal((await run('restore')).status, 'restored');
  assert.equal((await run('restoreNone')).status, 'nothing');
  assert.equal((await run('ok')).pro, true);
  assert.equal((await run('cancel')).pro, false);
});
