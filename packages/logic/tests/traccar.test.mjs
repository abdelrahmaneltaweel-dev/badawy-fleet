/**
 * Badawi Fleet Platform - Traccar Ingestion Client Tests (T5.1)
 * Ref: ADR-023 (Traccar Read-Only 12-Month Ingestion Window)
 * Ref: ADR-005, ADR-049
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TraccarClient } from '../dist/index.js';

// Setup Mock Fetch for Traccar Server responses
function createMockFetch(mockRoutes) {
  return async (url, options = {}) => {
    const urlStr = String(url);
    const method = options.method || 'GET';

    for (const route of mockRoutes) {
      if (route.method && route.method !== method) continue;
      if (urlStr.includes(route.path)) {
        if (route.error) {
          throw new Error(route.error);
        }
        return {
          ok: route.status ? route.status >= 200 && route.status < 300 : true,
          status: route.status || 200,
          headers: new Headers(route.headers || {}),
          json: async () => route.response,
          text: async () => JSON.stringify(route.response)
        };
      }
    }

    return {
      ok: false,
      status: 404,
      headers: new Headers(),
      json: async () => ({ error: 'Not Found' }),
      text: async () => 'Not Found'
    };
  };
}

test('T5.1.1: TraccarClient Authentication Headers & URL Normalization', () => {
  // 1. Bearer Token
  const c1 = new TraccarClient({
    url: 'http://traccar.internal:8082///',
    token: 'secret_token_123'
  });
  const headers1 = c1['getAuthHeaders']();
  assert.equal(headers1['Authorization'], 'Bearer secret_token_123');

  // 2. Basic Auth
  const c2 = new TraccarClient({
    url: 'http://traccar.internal:8082',
    username: 'readonly_user',
    password: 'readonly_pass'
  });
  const headers2 = c2['getAuthHeaders']();
  assert.match(headers2['Authorization'], /^Basic /);
});

test('T5.1.2: Server Connectivity & testConnection() Probe', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = createMockFetch([
    { path: '/api/server', response: { version: '5.12' } },
    {
      path: '/api/devices',
      response: [
        { id: 1, name: 'عربية 116', uniqueId: '116', status: 'online', disabled: false },
        { id: 2, name: 'عربية 118', uniqueId: '118', status: 'online', disabled: false }
      ]
    }
  ]);

  try {
    const client = new TraccarClient({
      url: 'http://traccar.internal:8082',
      token: 'test_token'
    });

    const status = await client.testConnection();
    assert.equal(status.ok, true);
    assert.equal(status.status, 200);
    assert.equal(status.serverVersion, '5.12');
    assert.equal(status.deviceCount, 2);
    assert.equal(status.authMethodUsed, 'Bearer Token');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('T5.1.3: Device Listing with In-Memory Caching (TTL)', async () => {
  let networkCallCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (String(url).includes('/api/devices')) {
      networkCallCount++;
      return {
        ok: true,
        status: 200,
        json: async () => [
          { id: 101, name: 'عربية 116', uniqueId: '116', status: 'online', disabled: false }
        ]
      };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };

  try {
    const client = new TraccarClient({
      url: 'http://traccar.internal:8082',
      token: 'test_token'
    });

    // 1. First call hits network
    const dev1 = await client.getDevices();
    assert.equal(dev1.length, 1);
    assert.equal(networkCallCount, 1);

    // 2. Second immediate call hits cache
    const dev2 = await client.getDevices();
    assert.equal(dev2.length, 1);
    assert.equal(networkCallCount, 1); // Not incremented

    // 3. Forced refresh bypasses cache
    const dev3 = await client.getDevices(true);
    assert.equal(dev3.length, 1);
    assert.equal(networkCallCount, 2); // Incremented
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('T5.1.4: Unit Conversion — Knots to Km/h & Ignition Extraction', () => {
  const client = new TraccarClient({
    url: 'http://traccar.internal:8082',
    token: 'test_token',
    speedUnit: 'knots'
  });

  const rawPosition = {
    id: 5501,
    deviceId: 1,
    serverTime: '2026-11-06T10:00:00Z',
    deviceTime: '2026-11-06T10:00:00Z',
    fixTime: '2026-11-06T10:00:00Z',
    valid: true,
    latitude: 30.0444,
    longitude: 31.2357,
    altitude: 25,
    speed: 10, // 10 knots = 18.52 km/h
    course: 180,
    attributes: {
      ignition: true,
      totalDistance: 1250000
    }
  };

  const point = client.convertPositionToRawGps(rawPosition, '116');

  assert.equal(point.vehicleId, '116');
  assert.equal(point.latitude, 30.0444);
  assert.equal(point.longitude, 31.2357);
  assert.equal(point.speed, 18.5); // 10 * 1.852 = 18.5 km/h rounded to 1 decimal
  assert.equal(point.ignition, true);
  assert.equal(point.timestamp, '2026-11-06T10:00:00Z');
  assert.equal(point.course, 180);
});

test('T5.1.5: Throttled Batch Ingestion with Concurrency & Progress Callback (ADR-023)', async () => {
  const originalFetch = globalThis.fetch;
  const queriedDevices = [];

  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/api/positions')) {
      const match = urlStr.match(/deviceId=(\d+)/);
      if (match) queriedDevices.push(parseInt(match[1], 10));
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            id: 1,
            deviceId: parseInt(match?.[1] || '1', 10),
            latitude: 30.0,
            longitude: 31.0,
            speed: 5,
            fixTime: '2026-11-06T08:00:00Z',
            valid: true
          }
        ]
      };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };

  try {
    const client = new TraccarClient({
      url: 'http://traccar.internal:8082',
      token: 'test_token'
    });

    const devices = [
      { deviceId: 1, vehicleId: '116' },
      { deviceId: 2, vehicleId: '118' },
      { deviceId: 3, vehicleId: '124' },
      { deviceId: 4, vehicleId: '114' },
      { deviceId: 5, vehicleId: '132' }
    ];

    let progressCalls = 0;
    const progressLog = [];

    const start = Date.now();
    const batchResult = await client.getPositionsBatch({
      devices,
      from: '2026-11-06T06:00:00Z',
      to: '2026-11-06T18:00:00Z',
      batchSize: 2, // 2 vehicles per batch
      delayBetweenBatchesMs: 50, // 50ms pause between batches
      onProgress: (done, total, vId) => {
        progressCalls++;
        progressLog.push({ done, total, vId });
      }
    });
    const elapsed = Date.now() - start;

    assert.equal(batchResult.size, 5);
    assert.equal(batchResult.get('116')?.length, 1);
    assert.equal(batchResult.get('118')?.length, 1);
    assert.equal(queriedDevices.length, 5);
    assert.equal(progressCalls, 5);
    assert.equal(progressLog[4].done, 5);
    assert.equal(progressLog[4].total, 5);
    // At least 2 batch delays of 50ms occurred
    assert.ok(elapsed >= 80, `Expected elapsed >= 80ms due to throttling, got ${elapsed}ms`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('T5.1.6: Safe Resilience — Individual Device Failure Does Not Abort Entire Fleet', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('deviceId=2')) {
      // Vehicle 118 fails with 500 error
      return {
        ok: false,
        status: 500,
        text: async () => 'Internal Error'
      };
    }
    if (urlStr.includes('/api/positions')) {
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            id: 99,
            deviceId: 1,
            latitude: 30.0,
            longitude: 31.0,
            speed: 0,
            fixTime: '2026-11-06T09:00:00Z',
            valid: true
          }
        ]
      };
    }
    return { ok: false, status: 404, text: async () => 'Not Found' };
  };

  try {
    const client = new TraccarClient({
      url: 'http://traccar.internal:8082',
      token: 'test_token',
      timeoutMs: 1000
    });

    const devices = [
      { deviceId: 1, vehicleId: '116' },
      { deviceId: 2, vehicleId: '118' }, // This one errors
      { deviceId: 3, vehicleId: '124' }
    ];

    const result = await client.getPositionsBatch({
      devices,
      from: '2026-11-06T06:00:00Z',
      to: '2026-11-06T18:00:00Z',
      batchSize: 2,
      delayBetweenBatchesMs: 10
    });

    // 116 and 124 succeed, while 118 gracefully receives empty array without throwing
    assert.equal(result.get('116')?.length, 1);
    assert.equal(result.get('118')?.length, 0);
    assert.equal(result.get('124')?.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
