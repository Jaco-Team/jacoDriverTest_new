
import {createFinishQueue, type PendingFinish} from '@/shared/lib/finishQueue';

describe('durable offline completions', () => {
  let raw: string | null;
  let online: boolean;
  let owner: string;
  let session: string;
  let failWrite: boolean;
  type SendFinish = Parameters<typeof createFinishQueue>[0]['send'];
  const sendImplementation: SendFinish = async () => ({ok: true, retryable: false});
  const send = jest.fn(sendImplementation);
  const rejected = jest.fn();
  const entry: PendingFinish = {owner: '7', pointId: 10, orderId: 100,
    completedAt: '2026-11-19T19:55:30.000Z', latitude: '53.5', longitude: '49.4'};
  const makeQueue = (retainAcknowledged = false) => createFinishQueue({
    retainAcknowledged,
    read: async () => raw,
    write: async value => {if (failWrite) throw new Error('disk full'); raw = value;},
    owner: () => owner,
    session: () => session,
    online: () => online,
    send,
    rejected,
  });
  beforeEach(() => {
    raw = null; online = false; owner = '7'; session = 'session-a'; failWrite = false;
    send.mockReset();
    rejected.mockReset();
    send.mockResolvedValue({ok: true, retryable: false});
  });
  it('preserves action time and coordinates after restart and delayed reconnection', async () => {
    const first = makeQueue();
    await first.put(entry);
    await first.flush();
    expect(send).not.toHaveBeenCalled();
    const restarted = makeQueue();
    await restarted.hydrate();
    expect(restarted.find('7', 10, 100)).toEqual(entry);
    online = true;
    await restarted.flush();
    expect(send).toHaveBeenCalledWith(entry);
    expect(JSON.parse(raw!)).toEqual([]);
  });
  it('preserves the first action on repeated taps, including another cafe with the same order id', async () => {
    const queue = makeQueue();
    await queue.put(entry);
    await queue.put({...entry, completedAt: '2026-11-20T00:10:00.000Z', latitude: '0'});
    await queue.put({...entry, pointId: 20});
    expect(queue.find('7', 10, 100)?.completedAt).toBe(entry.completedAt);
    expect(queue.find('7', 10, 100)?.latitude).toBe('53.5');
    expect(JSON.parse(raw!)).toHaveLength(2);
  });
  it('keeps a command after a lost response and replays exactly the original request', async () => {
    online = true;
    send.mockRejectedValueOnce(new Error('response lost'));
    const queue = makeQueue();
    await queue.put(entry);
    await queue.flush();
    expect(JSON.parse(raw!)).toEqual([entry]);
    await makeQueue().flush();
    expect(send).toHaveBeenNthCalledWith(1, entry);
    expect(send).toHaveBeenNthCalledWith(2, entry);
    expect(JSON.parse(raw!)).toEqual([]);
  });
  it('never acknowledges a completion when storage fails', async () => {
    const queue = makeQueue(); failWrite = true;
    await expect(queue.put(entry)).rejects.toThrow('disk full');
    expect(queue.find('7', 10, 100)).toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });
  it('does not overwrite malformed saved data', async () => {
    raw = '{damaged';
    await expect(makeQueue().put(entry)).rejects.toThrow();
    expect(raw).toBe('{damaged');
  });
  it('does not send another account\'s command', async () => {
    const queue = makeQueue(); await queue.put(entry); owner = '8'; online = true;
    await queue.flush();
    expect(send).not.toHaveBeenCalled(); expect(JSON.parse(raw!)).toEqual([entry]);
  });
  it('reports an explicit refusal and releases the order without blocking the next completion', async () => {
    online = true;
    send.mockResolvedValueOnce({ok: false, retryable: false, text: 'Заказ еще готовится'});
    const queue = makeQueue();
    await queue.put(entry);
    await queue.put({...entry, orderId: 101});
    await queue.flush();
    expect(rejected).toHaveBeenCalledWith(entry, 'Заказ еще готовится');
    expect(queue.find('7', 10, 100)).toBeUndefined();
    expect(JSON.parse(raw!)).toEqual([]);
    await queue.flush();
    expect(send).toHaveBeenCalledTimes(2);
  });
  it('keeps retryable failures saved with the original time', async () => {
    online = true;
    send.mockResolvedValueOnce({ok: false, retryable: true, text: 'Временная ошибка'});
    const queue = makeQueue();
    await queue.put(entry);
    await queue.flush();
    expect(JSON.parse(raw!)).toEqual([entry]);
    expect(rejected).not.toHaveBeenCalled();
    await queue.flush();
    expect(send).toHaveBeenNthCalledWith(2, entry);
  });
  it('releases only this account legacy refusal without sending it again or dropping pending commands', async () => {
    const legacy = {...entry, error: 'Заказ еще готовится'};
    const other = {...legacy, owner: '8'};
    const pending = {...entry, orderId: 101};
    raw = JSON.stringify([legacy, other, pending]);
    const queue = makeQueue();
    await queue.flush();
    expect(send).not.toHaveBeenCalled();
    expect(rejected).toHaveBeenCalledWith(legacy, legacy.error);
    expect(JSON.parse(raw!)).toEqual([other, pending]);
    expect(queue.find('7', 10, 100)).toBeUndefined();
  });
  it('serializes overlapping senders without losing a second command saved during a request', async () => {
    online = true;
    let resolve!: (result: {ok: boolean; retryable: boolean}) => void;
    send.mockImplementationOnce(() => new Promise(done => {resolve = done;}));
    const queue = makeQueue(); await queue.put(entry);
    const first = queue.flush(); const second = queue.flush();
    // Wait for the controlled network boundary, without arbitrary timer sleeps.
    for (let i = 0; i < 30 && !resolve; i++) await Promise.resolve();
    expect(resolve).toBeDefined();
    await queue.put({...entry, orderId: 101});
    resolve({ok: true, retryable: false}); await Promise.all([first, second]);
    expect(JSON.parse(raw!).map((item: PendingFinish) => item.orderId)).toEqual([101]);
    await queue.flush(); expect(send).toHaveBeenCalledTimes(2);
  });
  it('stops sending when the session changes during a request', async () => {
    online = true;
    const queue = makeQueue(); await queue.put(entry); await queue.put({...entry, orderId: 101});
    send.mockImplementationOnce(async () => {session = 'session-b'; return {ok: true, retryable: false};});
    await queue.flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(raw!).map((item: PendingFinish) => item.orderId)).toEqual([101]);
  });
  it('keeps an accepted completion across restart without sending it again until the list confirms it', async () => {
    online = true;
    const queue = makeQueue(true);
    await queue.put(entry);
    await queue.flush();
    expect(queue.find('7', 10, 100)).toEqual({...entry, acknowledged: true});

    const restarted = makeQueue(true);
    await restarted.hydrate();
    await restarted.flush();
    await restarted.put({...entry, completedAt: '2026-11-20T00:10:00.000Z'});
    await restarted.flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(restarted.find('7', 10, 100)?.completedAt).toBe(entry.completedAt);
    await restarted.confirmAcknowledged('7', 10, [100]);
    expect(restarted.find('7', 10, 100)).toBeUndefined();
    expect(JSON.parse(raw!)).toEqual([]);
  });
  it('only releases accepted commands for the confirmed account, cafe and order', async () => {
    online = true;
    const queue = makeQueue(true);
    await queue.put(entry);
    await queue.put({...entry, pointId: 20});
    await queue.flush();
    online = false;
    await queue.put({...entry, orderId: 101});
    await queue.confirmAcknowledged('8', 10, [100]);
    await queue.confirmAcknowledged('7', 10, [101]);
    expect(queue.find('7', 10, 100)?.acknowledged).toBe(true);
    expect(queue.find('7', 10, 101)).toEqual({...entry, orderId: 101});
    await queue.confirmAcknowledged('7', 10, [100]);
    expect(queue.find('7', 20, 100)?.acknowledged).toBe(true);
    expect(queue.find('7', 10, 100)).toBeUndefined();
  });
  it('keeps the accepted guard if removing it from storage fails', async () => {
    online = true;
    const queue = makeQueue(true);
    await queue.put(entry);
    await queue.flush();
    failWrite = true;
    await expect(queue.confirmAcknowledged('7', 10, [100])).rejects.toThrow('disk full');
    expect(queue.find('7', 10, 100)?.acknowledged).toBe(true);
    await queue.flush();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('distinguishes the initial success event from retries of the list refresh', async () => {
    online = true;
    const acknowledged = jest.fn();
    const queue = createFinishQueue({read: async () => raw, write: async value => {raw = value;},
      owner: () => owner, session: () => session, online: () => online, send,
      retainAcknowledged: true, acknowledged});
    await queue.put(entry);
    await queue.flush();
    await queue.flush();
    expect(acknowledged).toHaveBeenNthCalledWith(1, entry, true);
    expect(acknowledged).toHaveBeenNthCalledWith(2, {...entry, acknowledged: true}, false);
    expect(send).toHaveBeenCalledTimes(1);
  });

});
