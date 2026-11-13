// AccountsStore on any SqlDriver, over the tables in migrations/. Writes that
// belong together go in one batch (one transaction).

import type { AccountRow, AccountsStore, SessionRow, SettingRow, SettingValue, ShareLinkRow } from '../../core/store.ts';
import { MAX_PARAMS, type SqlDriver, type SqlStatement } from './driver.ts';

interface AccountDbRow {
  id: string;
  google_sub: string;
  email: string;
  created: number;
  last_seen: number;
}

interface SessionJoinRow extends AccountDbRow {
  token_hash: string;
  account_id: string;
  s_created: number;
  last_used: number;
}

const ACCOUNT_COLUMNS = 'a.id, a.google_sub, a.email, a.created, a.last_seen';

/** Columns per account_shares row in a multi-row insert. */
const SHARE_PARAMS = 3;

/** Columns per account_settings row in a multi-row insert. */
const SETTING_PARAMS = 4;

interface SettingDbRow {
  key: string;
  /** The value as JSON text. */
  value: string;
  at: number;
}

/** An AccountsStore on `db`. */
export function createSqlStore(db: SqlDriver): AccountsStore {
  const readSettings = async (accountId: string): Promise<SettingRow[]> => {
    const rows = await db.all<SettingDbRow>('SELECT key, value, at FROM account_settings WHERE account_id = ? ORDER BY key', [accountId]);
    return rows.map(settingOf);
  };

  return {
    async putNonce(nonce, expires, now) {
      await db.batch([
        { sql: 'DELETE FROM nonces WHERE expires <= ?', params: [now] },
        { sql: 'INSERT INTO nonces (nonce, expires) VALUES (?, ?)', params: [nonce, expires] },
      ]);
    },

    async takeNonce(nonce, now) {
      const [del] = await db.batch([{ sql: 'DELETE FROM nonces WHERE nonce = ? AND expires > ?', params: [nonce, now] }]);
      if (del?.changes === 1) return true;
      // An expired one goes too, so it is gone either way.
      await db.batch([{ sql: 'DELETE FROM nonces WHERE nonce = ?', params: [nonce] }]);
      return false;
    },

    async upsertAccount({ id, googleSub, email, now }) {
      await db.batch([
        {
          sql:
            'INSERT INTO accounts (id, google_sub, email, created, last_seen) VALUES (?, ?, ?, ?, ?) ' +
            'ON CONFLICT (google_sub) DO UPDATE SET email = excluded.email, last_seen = excluded.last_seen',
          params: [id, googleSub, email, now, now],
        },
      ]);
      const rows = await db.all<AccountDbRow>(`SELECT ${ACCOUNT_COLUMNS} FROM accounts a WHERE a.google_sub = ?`, [googleSub]);
      const row = rows[0];
      if (!row) throw new Error('account missing right after its upsert');
      return accountOf(row);
    },

    async createSession(s) {
      await db.batch([
        {
          sql: 'INSERT INTO sessions (token_hash, account_id, created, last_used) VALUES (?, ?, ?, ?)',
          params: [s.tokenHash, s.accountId, s.created, s.lastUsed],
        },
      ]);
    },

    async findSession(tokenHash) {
      const rows = await db.all<SessionJoinRow>(
        `SELECT s.token_hash, s.account_id, s.created AS s_created, s.last_used, ${ACCOUNT_COLUMNS} ` +
          'FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ?',
        [tokenHash],
      );
      const r = rows[0];
      if (!r) return null;
      const session: SessionRow = { tokenHash: r.token_hash, accountId: r.account_id, created: r.s_created, lastUsed: r.last_used };
      return { session, account: accountOf(r) };
    },

    async touchSession(tokenHash, accountId, now) {
      await db.batch([
        { sql: 'UPDATE sessions SET last_used = ? WHERE token_hash = ?', params: [now, tokenHash] },
        { sql: 'UPDATE accounts SET last_seen = ? WHERE id = ?', params: [now, accountId] },
      ]);
    },

    async deleteSession(tokenHash) {
      const [del] = await db.batch([{ sql: 'DELETE FROM sessions WHERE token_hash = ?', params: [tokenHash] }]);
      return (del?.changes ?? 0) > 0;
    },

    async pruneSessions(before) {
      const [del] = await db.batch([{ sql: 'DELETE FROM sessions WHERE last_used < ?', params: [before] }]);
      return del?.changes ?? 0;
    },

    async mergeShares(accountId, links, cap) {
      const stmts: SqlStatement[] = [];
      const perStmt = Math.floor(MAX_PARAMS / SHARE_PARAMS);
      for (let i = 0; i < links.length; i += perStmt) {
        const chunk = links.slice(i, i + perStmt);
        stmts.push({
          sql:
            `INSERT INTO account_shares (account_id, code, created) VALUES ${chunk.map(() => '(?, ?, ?)').join(', ')} ` +
            'ON CONFLICT (account_id, code) DO UPDATE SET created = MIN(account_shares.created, excluded.created)',
          params: chunk.flatMap((l) => [accountId, l.code, l.created]),
        });
      }
      stmts.push({
        sql:
          'DELETE FROM account_shares WHERE account_id = ? AND code NOT IN ' +
          '(SELECT code FROM account_shares WHERE account_id = ? ORDER BY created DESC, code DESC LIMIT ?)',
        params: [accountId, accountId, cap],
      });
      await db.batch(stmts);
      const rows = await db.all<ShareLinkRow>(
        'SELECT code, created FROM account_shares WHERE account_id = ? ORDER BY created DESC, code DESC LIMIT ?',
        [accountId, cap],
      );
      return rows.map((r) => ({ code: r.code, created: r.created }));
    },

    getSettings: readSettings,

    async mergeSettings(accountId, rows, cap) {
      const stmts: SqlStatement[] = [];
      const perStmt = Math.floor(MAX_PARAMS / SETTING_PARAMS);
      for (let i = 0; i < rows.length; i += perStmt) {
        const chunk = rows.slice(i, i + perStmt);
        stmts.push({
          sql:
            `INSERT INTO account_settings (account_id, key, value, at) VALUES ${chunk.map(() => '(?, ?, ?, ?)').join(', ')} ` +
            'ON CONFLICT (account_id, key) DO UPDATE SET value = excluded.value, at = excluded.at WHERE excluded.at > account_settings.at',
          params: chunk.flatMap((r) => [accountId, r.key, JSON.stringify(r.value), r.at]),
        });
      }
      stmts.push({
        sql:
          'DELETE FROM account_settings WHERE account_id = ? AND key NOT IN ' +
          '(SELECT key FROM account_settings WHERE account_id = ? ORDER BY at DESC, key ASC LIMIT ?)',
        params: [accountId, accountId, cap],
      });
      await db.batch(stmts);
      return readSettings(accountId);
    },

    async deleteAccount(accountId) {
      await db.batch([
        { sql: 'DELETE FROM account_settings WHERE account_id = ?', params: [accountId] },
        { sql: 'DELETE FROM account_shares WHERE account_id = ?', params: [accountId] },
        { sql: 'DELETE FROM sessions WHERE account_id = ?', params: [accountId] },
        { sql: 'DELETE FROM accounts WHERE id = ?', params: [accountId] },
      ]);
    },
  };
}

function settingOf(r: SettingDbRow): SettingRow {
  return { key: r.key, value: JSON.parse(r.value) as SettingValue, at: r.at };
}

function accountOf(r: AccountDbRow): AccountRow {
  return { id: r.id, googleSub: r.google_sub, email: r.email, created: r.created, lastSeen: r.last_seen };
}
