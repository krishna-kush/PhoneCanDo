// AccountsStore in memory: the reference the SQL store is tested against, and
// the store for route tests. Not for production (nothing survives a restart).

import {
  byKey,
  byLatest,
  byNewest,
  type AccountRow,
  type AccountsStore,
  type SessionRow,
  type SettingRow,
  type ShareLinkRow,
} from '../../core/store.ts';

/** A fresh, empty in-memory store. */
export function createMemoryStore(): AccountsStore {
  const nonces = new Map<string, number>();
  const accounts = new Map<string, AccountRow>(); // by id
  const sessions = new Map<string, SessionRow>(); // by token hash
  const shares = new Map<string, Map<string, number>>(); // account id -> code -> created
  const settings = new Map<string, Map<string, SettingRow>>(); // account id -> key -> setting

  const bySub = (sub: string): AccountRow | undefined => [...accounts.values()].find((a) => a.googleSub === sub);

  return {
    async putNonce(nonce, expires, now) {
      for (const [n, e] of nonces) if (e <= now) nonces.delete(n);
      nonces.set(nonce, expires);
    },

    async takeNonce(nonce, now) {
      const expires = nonces.get(nonce);
      nonces.delete(nonce);
      return expires !== undefined && expires > now;
    },

    async upsertAccount({ id, googleSub, email, now }) {
      const had = bySub(googleSub);
      const row: AccountRow = had ? { ...had, email, lastSeen: now } : { id, googleSub, email, created: now, lastSeen: now };
      accounts.set(row.id, row);
      return { ...row };
    },

    async createSession(row) {
      sessions.set(row.tokenHash, { ...row });
    },

    async findSession(tokenHash) {
      const session = sessions.get(tokenHash);
      const account = session && accounts.get(session.accountId);
      return session && account ? { session: { ...session }, account: { ...account } } : null;
    },

    async touchSession(tokenHash, accountId, now) {
      const s = sessions.get(tokenHash);
      if (s) s.lastUsed = now;
      const a = accounts.get(accountId);
      if (a) a.lastSeen = now;
    },

    async deleteSession(tokenHash) {
      return sessions.delete(tokenHash);
    },

    async pruneSessions(before) {
      let n = 0;
      for (const [hash, s] of sessions) {
        if (s.lastUsed < before) {
          sessions.delete(hash);
          n++;
        }
      }
      return n;
    },

    async mergeShares(accountId, links, cap) {
      const list = shares.get(accountId) ?? new Map<string, number>();
      for (const l of links) {
        const had = list.get(l.code);
        if (had === undefined || l.created < had) list.set(l.code, l.created);
      }
      const kept: ShareLinkRow[] = [...list].map(([code, created]) => ({ code, created })).sort(byNewest).slice(0, cap);
      shares.set(accountId, new Map(kept.map((l) => [l.code, l.created])));
      return kept;
    },

    async getSettings(accountId) {
      return [...(settings.get(accountId)?.values() ?? [])].sort(byKey);
    },

    async mergeSettings(accountId, rows, cap) {
      const kept = new Map(settings.get(accountId) ?? []);
      for (const r of rows) {
        const had = kept.get(r.key);
        if (had === undefined || r.at > had.at) kept.set(r.key, { ...r });
      }
      const newest = [...kept.values()].sort(byLatest).slice(0, cap);
      settings.set(accountId, new Map(newest.map((r) => [r.key, r])));
      return newest.sort(byKey);
    },

    async deleteAccount(accountId) {
      shares.delete(accountId);
      settings.delete(accountId);
      for (const [hash, s] of sessions) if (s.accountId === accountId) sessions.delete(hash);
      accounts.delete(accountId);
    },
  };
}
