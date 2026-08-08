/**
 * Offline queue (§15). You do not need CRDTs. You need three rules:
 *
 *  1. DNA profile — last-write-wins on the whole object, guarded by updated_at.
 *  2. Artifacts + transforms — immutable, insert-only. `edited_output` is the
 *     one mutable column, and it is single-writer per session in practice.
 *  3. Offline queue — an outbox per surface, replayed in order on reconnect.
 *     Idempotency key = clientId, so a replayed item can never double-apply.
 */

export type OutboxOp = 'transform' | 'ingest' | 'dna' | 'ledger';

export interface OutboxItem {
  id: string;
  op: OutboxOp;
  body: unknown;
  ts: number;
  tries: number;
}

export interface Outbox {
  all(): Promise<OutboxItem[]>;
  add(item: OutboxItem): Promise<void>;
  remove(id: string): Promise<void>;
  bump(id: string): Promise<void>;
  /** Move to a dead-letter state. Never retry forever; surface it instead. */
  park(id: string): Promise<void>;
}

export interface Api {
  post(path: string, body: unknown, init?: { headers?: Record<string, string> }): Promise<unknown>;
}

export const MAX_TRIES = 5;

export async function flush(outbox: Outbox, api: Api): Promise<{ sent: number; parked: number }> {
  let sent = 0;
  let parked = 0;

  for (const item of await outbox.all()) {
    try {
      await api.post(`/api/${item.op}`, item.body, {
        headers: { 'Idempotency-Key': item.id },
      });
      await outbox.remove(item.id);
      sent++;
    } catch {
      if (item.tries >= MAX_TRIES) {
        await outbox.park(item.id);
        parked++;
        continue;
      }
      await outbox.bump(item.id);
      break; // preserve ordering — a later item must not overtake a failed earlier one
    }
  }

  return { sent, parked };
}

/** A chrome.storage / AsyncStorage-backed outbox. Works on Lens and Go alike. */
export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export function createOutbox(store: KeyValueStore, key = 'setu.outbox'): Outbox {
  const read = async (): Promise<OutboxItem[]> => {
    const raw = await store.get(key);
    return Array.isArray(raw) ? (raw as OutboxItem[]) : [];
  };
  const write = (items: OutboxItem[]) => store.set(key, items);

  return {
    async all() {
      return (await read()).filter((i) => i.tries < MAX_TRIES).sort((a, b) => a.ts - b.ts);
    },
    async add(item) {
      const items = await read();
      if (items.some((i) => i.id === item.id)) return; // idempotent enqueue
      items.push(item);
      await write(items.slice(-200));
    },
    async remove(id) {
      await write((await read()).filter((i) => i.id !== id));
    },
    async bump(id) {
      const items = await read();
      const it = items.find((i) => i.id === id);
      if (it) it.tries++;
      await write(items);
    },
    async park(id) {
      const items = await read();
      const it = items.find((i) => i.id === id);
      if (it) it.tries = MAX_TRIES;
      await write(items);
    },
  };
}

export function newOutboxItem(op: OutboxOp, body: unknown): OutboxItem {
  return { id: crypto.randomUUID(), op, body, ts: Date.now(), tries: 0 };
}
