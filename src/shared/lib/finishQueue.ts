/** Durable completion commands. Reads/writes are serialized; network waits never hold the storage lock. */
export interface PendingFinish {
  owner: string;
  pointId: number;
  orderId: number;
  completedAt: string;
  latitude: string;
  longitude: string;
  /** Legacy saved rejection; consumed without resending after upgrading. */
  error?: string;
  acknowledged?: true;
}
interface QueueOptions {
  exclusive?: <T>(work: () => Promise<T>) => Promise<T>;
  read: () => Promise<string | null>;
  write: (value: string) => Promise<void>;
  owner: () => string | null;
  session: () => string | null;
  online: () => boolean;
  retainAcknowledged?: boolean;
  acknowledged?: (entry: PendingFinish, newlyAcknowledged: boolean) => void;
  rejected?: (entry: PendingFinish, text: string) => void;
  send: (entry: PendingFinish) => Promise<{ok: boolean; retryable: boolean; text?: string}>;
}
const key = (entry: Pick<PendingFinish, 'owner' | 'pointId' | 'orderId'>) =>
  JSON.stringify([entry.owner, entry.pointId, entry.orderId]);

export function createFinishQueue(options: QueueOptions) {
  let entries: PendingFinish[] = [];
  let revision = 0;
  const listeners = new Set<() => void>();
  let storage: Promise<unknown> = Promise.resolve();
  let sending: Promise<void> | null = null;
  function publish(next: PendingFinish[]) {
    entries = next;
    revision++;
    listeners.forEach(listener => listener());
  }
  function transaction<T>(work: (current: PendingFinish[]) => Promise<T>): Promise<T> {
    const workWithStorage = async () => {
      const raw = await options.read();
      let parsed: unknown;
      try {parsed = raw === null ? [] : JSON.parse(raw);} catch {
        throw new Error('Не удалось прочитать сохранённые завершения заказов.');
      }
      if (!Array.isArray(parsed) || !parsed.every(entry => entry &&
        typeof entry.owner === 'string' && entry.owner.length > 0 &&
        Number.isInteger(entry.pointId) && entry.pointId > 0 &&
        Number.isInteger(entry.orderId) && entry.orderId > 0 &&
        typeof entry.completedAt === 'string' && Number.isFinite(Date.parse(entry.completedAt)) &&
        typeof entry.latitude === 'string' && typeof entry.longitude === 'string' &&
        (entry.error === undefined || typeof entry.error === 'string') &&
        (entry.acknowledged === undefined || entry.acknowledged === true))) {
        throw new Error('Не удалось прочитать сохранённые завершения заказов.');
      }
      return work(parsed as PendingFinish[]);
    };
    const operation = storage.then(() => options.exclusive ? options.exclusive(workWithStorage) : workWithStorage());
    storage = operation.catch(() => undefined);
    return operation;
  }
  async function save(next: PendingFinish[]) {
    await options.write(JSON.stringify(next));
    publish(next);
  }
  async function reject(entry: PendingFinish, text: string, session: string) {
    const removed = await transaction(async current => {
      const next = current.filter(item => !(key(item) === key(entry) &&
        item.completedAt === entry.completedAt && !item.acknowledged));
      if (next.length === current.length) return false;
      await save(next);
      return true;
    });
    if (removed && options.owner() === entry.owner && options.session() === session) {
      try {options.rejected?.(entry, text);} catch { /* The explicit server refusal is already recorded. */ }
    }
  }
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => {listeners.delete(listener);}; },
    revision: () => revision,
    find(owner: string | null, pointId: number | null, orderId: number) {
      return entries.find(entry => entry.owner === owner && entry.pointId === pointId && entry.orderId === orderId);
    },
    hydrate: () => transaction(async current => {publish(current);}),
    put: (entry: PendingFinish) => transaction(async current => {
      if (!entry.owner || !Number.isInteger(entry.pointId) || entry.pointId <= 0 || !Number.isInteger(entry.orderId) || entry.orderId <= 0 || !Number.isFinite(Date.parse(entry.completedAt))) {
        throw new Error('Не удалось сохранить завершение: не определены заказ, курьер, кафе или время.');
      }
      const previous = current.find(item => key(item) === key(entry));
      const saved = previous ? {...previous, error: undefined} : entry;
      await save([...current.filter(item => key(item) !== key(entry)), saved]);
      return saved;
    }),
    // Release the UI guard only after a fresh completed status has been cached.
    confirmAcknowledged: (owner: string | null, pointId: number | null, orderIds: number[]) =>
      transaction(async current => {
        const confirmed = new Set(orderIds);
        const next = current.filter(entry => !(entry.acknowledged && entry.owner === owner &&
          entry.pointId === pointId && confirmed.has(entry.orderId)));
        if (next.length !== current.length) await save(next);
      }),
    flush(): Promise<void> {
      if (sending) return sending;
      sending = (async () => {
        await transaction(async current => {publish(current);});
        const owner = options.owner();
        const session = options.session();
        if (!owner || !session) return;
        for (const entry of [...entries]) {
          if (options.owner() !== owner || options.session() !== session) break;
          if (entry.owner !== owner) continue;
          if (entry.error && !entry.acknowledged) {
            await reject(entry, entry.error, session);
            continue;
          }
          if (!options.online()) break;
          if (entry.acknowledged) {
            // The server has accepted this command. Retry only the list refresh.
            try {options.acknowledged?.(entry, false);} catch { /* Keep the durable UI guard. */ }
            continue;
          }
          let result;
          try { result = await options.send(entry); } catch { break; }
          if (!result.ok && result.retryable) break;
          if (!result.ok) {
            await reject(entry, result.text || 'Не удалось завершить заказ.', session);
            continue;
          }
          await transaction(async current => {
            // A late response only acknowledges this original command.
            const next = current.flatMap(item => key(item) !== key(entry) || item.completedAt !== entry.completedAt
              ? [item] : options.retainAcknowledged ? [{...item, acknowledged: true as const}] : []);
            await save(next);
          });
          if (result.ok && options.owner() === owner && options.session() === session) {
            try {options.acknowledged?.(entry, true);} catch { /* The durable acknowledgement is already saved. */ }
          }
        }
      })().finally(() => {sending = null;});
      return sending;
    },
  };
}
