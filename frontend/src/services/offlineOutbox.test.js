import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enqueue, listForUser, sendOutboxItem, syncForUser } from './offlineOutbox';

describe('offline health outbox', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('stores and synchronizes a reading once, retaining its idempotency key', async () => {
    const userId = `offline-test-${globalThis.crypto.randomUUID()}`;
    const queued = await enqueue({
      userId,
      kind: 'health-record',
      payload: { bloodSugar: 143, recordedAt: '2026-10-07T00:00:00.000Z' },
    });
    const send = vi.fn(async (item) => ({
      data: { data: { record: { _id: 'server-record-1' }, clientRequestId: item.id } },
    }));

    const result = await syncForUser(userId, send);

    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      id: queued.id,
      payload: { bloodSugar: 143, recordedAt: '2026-10-07T00:00:00.000Z' },
    }));
    expect(result).toMatchObject({ synced: 1, remaining: 0 });
    expect(await listForUser(userId)).toEqual([]);
  });

  it('keeps network-failed items queued and marks rejected data for review', async () => {
    const userId = `offline-test-${globalThis.crypto.randomUUID()}`;
    const queued = await enqueue({ userId, kind: 'health-record', payload: { bloodSugar: 143 } });
    await syncForUser(userId, async () => { throw new Error('Network error'); });
    expect(await listForUser(userId)).toMatchObject([{ id: queued.id, status: 'queued' }]);

    await syncForUser(userId, async () => {
      const error = new Error('Invalid reading');
      error.response = { status: 400, data: { message: 'Review reading values.' } };
      throw error;
    });

    expect(await listForUser(userId)).toMatchObject([
      { id: queued.id, status: 'failed', error: 'Review reading values.' },
    ]);
  });

  it('does not sync another account’s queued health data with the current session token', async () => {
    const ownerId = `offline-owner-${globalThis.crypto.randomUUID()}`;
    await enqueue({ userId: ownerId, kind: 'health-record', payload: { bloodSugar: 121 } });
    localStorage.setItem('user', JSON.stringify({ id: 'different-account', role: 'patient', name: 'Other' }));

    const result = await syncForUser(ownerId, sendOutboxItem);

    expect(result).toMatchObject({ synced: 0, remaining: 1 });
    expect(await listForUser(ownerId)).toMatchObject([{ status: 'queued' }]);
  });
});
