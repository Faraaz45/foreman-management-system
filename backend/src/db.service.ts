import { Injectable, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { createHash, randomBytes } from 'crypto';
import { join } from 'path';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS sectors       (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS foremen       (id TEXT PRIMARY KEY, name TEXT NOT NULL, sector_id TEXT, subsector TEXT DEFAULT '',
  route_count INT DEFAULT 0, vehicle_brand TEXT DEFAULT '', plate_number TEXT DEFAULT '', phone_number TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS subsectors    (id SERIAL PRIMARY KEY, sector_id TEXT, name TEXT UNIQUE NOT NULL,
  route_count INT DEFAULT 0, foreman_id TEXT);
CREATE TABLE IF NOT EXISTS labourers     (id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '', subsector TEXT DEFAULT '', route TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS drivers       (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS vehicle_types (name TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS problem_types (name TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS reports       (id SERIAL PRIMARY KEY, foreman_id TEXT NOT NULL, date DATE NOT NULL,
  shift_start TEXT DEFAULT '', shift_end TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'Draft',
  labour_rows JSONB NOT NULL DEFAULT '[]', vehicle_blocks JSONB NOT NULL DEFAULT '[]', bin_rows JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now());
ALTER TABLE reports ADD COLUMN IF NOT EXISTS review_note TEXT DEFAULT '';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'foreman', foreman_id TEXT);
`;

// table -> [pk column, ...other columns] (snake_case). camelCase <-> snake_case is mechanical.
export const TABLES: Record<string, string[]> = {
  sectors: ['id', 'name'],
  foremen: ['id', 'name', 'sector_id', 'subsector', 'route_count', 'vehicle_brand', 'plate_number', 'phone_number'],
  subsectors: ['name', 'sector_id', 'route_count', 'foreman_id'], // upsert key is name; id is serial
  labourers: ['id', 'name', 'subsector', 'route'],
  drivers: ['id', 'name'],
  vehicle_types: ['name'],
  problem_types: ['name'],
};
export const snake = (s: string) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
export const camel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
export const camelRow = (r: any) => Object.fromEntries(Object.entries(r).map(([k, v]) => [camel(k), v]));

@Injectable()
export class DbService implements OnModuleInit {
  pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://localhost/foreman' });
  q = (sql: string, params: any[] = []) => this.pool.query(sql, params);

  async onModuleInit() {
    await this.q(SCHEMA);
    const { rows } = await this.q('SELECT count(*)::int AS n FROM foremen');
    if (rows[0].n === 0) await this.seed();
    await this.seedUsers();
  }

  // ---- users: two shared logins, admin/admin and foreman/foreman. Foremen pick their name in the Report form. ----
  hash(pw: string, salt = randomBytes(8).toString('hex')) { return salt + ':' + createHash('sha256').update(salt + pw).digest('hex'); }
  checkPw(pw: string, stored: string) { return stored === this.hash(pw, stored.split(':')[0]); }
  async seedUsers() {
    await this.q(`INSERT INTO users (username,password_hash,role) VALUES ('admin',$1,'admin'), ('foreman',$2,'foreman') ON CONFLICT DO NOTHING`, [this.hash('admin'), this.hash('foreman')]);
    await this.q('DELETE FROM users WHERE foreman_id IS NOT NULL'); // migration: drop the old per-foreman logins
  }
  async users() { return (await this.q('SELECT username, role FROM users ORDER BY role, username')).rows.map(camelRow); }

  async seed() {
    const seed = JSON.parse(readFileSync(join(__dirname, '..', 'seed.json'), 'utf8'));
    for (const t of Object.keys(TABLES)) {
      const rows = seed[camel(t)] || [];
      for (const r of rows) await this.upsert(t, typeof r === 'string' ? { name: r } : r);
    }
    console.log('Seeded master data');
  }

  async upsert(table: string, row: any) {
    const cols = TABLES[table];
    if (!cols) throw new Error('unknown table ' + table);
    const vals = cols.map((c) => row[camel(c)] ?? row[c] ?? (c.endsWith('_count') ? 0 : c === 'foreman_id' ? null : ''));
    const updates = cols.slice(1).map((c) => `${c}=EXCLUDED.${c}`).join(', ');
    const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map((_, i) => '$' + (i + 1)).join(',')})
      ON CONFLICT (${cols[0]}) DO ${updates ? 'UPDATE SET ' + updates : 'NOTHING'} RETURNING *`;
    return camelRow((await this.q(sql, vals)).rows[0]);
  }

  async state(role = 'foreman') {
    const out: any = {};
    for (const t of Object.keys(TABLES)) {
      const { rows } = await this.q(`SELECT * FROM ${t} ORDER BY 1`);
      out[camel(t)] = cols1(t) ? rows.map((r) => r.name) : rows.map(camelRow);
    }
    const { rows } = await this.q(`SELECT *, to_char(date, 'YYYY-MM-DD') AS date FROM reports ORDER BY reports.date DESC, reports.id DESC`);
    out.reports = rows.map(camelRow);
    if (role === 'admin') out.users = await this.users();
    return out;
  }
}
const cols1 = (t: string) => TABLES[t].length === 1; // vehicle_types / problem_types are plain string lists
