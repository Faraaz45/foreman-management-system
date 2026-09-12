import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Post, Put, Req } from '@nestjs/common';
import { admin } from './auth';
import { DbService, TABLES, camelRow } from './db.service';

const tableOf = (t: string) => { const s = t.replace(/[A-Z]/g, c => '_' + c.toLowerCase()); if (!TABLES[s]) throw new BadRequestException('unknown table'); return s; };
const arr = (v: any) => (Array.isArray(v) ? v : []);

@Controller()
export class ApiController {
  constructor(private db: DbService) {}

  @Get('state') state(@Req() req: any) { return this.db.state(req.user.role); }

  // ---- users (admin) ----
  @Get('users') users(@Req() req: any) { admin(req); return this.db.users(); }
  @Post('users')
  async saveUser(@Req() req: any, @Body() b: any) {
    admin(req);
    const username = String(b?.username || '').trim(); if (!username) throw new BadRequestException('username required');
    const role = b.role === 'admin' ? 'admin' : 'foreman';
    if (b.password) await this.db.q(`INSERT INTO users (username,password_hash,role) VALUES ($1,$2,$3)
      ON CONFLICT (username) DO UPDATE SET password_hash=EXCLUDED.password_hash, role=EXCLUDED.role`, [username, this.db.hash(b.password), role]);
    else await this.db.q('UPDATE users SET role=$2 WHERE username=$1', [username, role]);
    return { ok: true };
  }
  @Delete('users/:username')
  async deleteUser(@Req() req: any, @Param('username') u: string) {
    admin(req); if (u === 'admin') throw new BadRequestException('cannot delete admin');
    await this.db.q('DELETE FROM users WHERE username=$1', [u]); return { ok: true };
  }

  // Insert-or-update one row or an array of rows (Excel import). Body strings are allowed for vehicle_types/problem_types.
  @Post('master/:table')
  async upsert(@Req() req: any, @Param('table') t: string, @Body() body: any) {
    const table = tableOf(t);
    const rows = (Array.isArray(body) ? body : [body]).map(r => (typeof r === 'string' ? { name: r } : r));
    for (const r of rows) if (!String(r[TABLES[table][0] === 'name' ? 'name' : 'id'] ?? '').trim()) throw new BadRequestException('missing key');
    const out: any[] = [];
    for (const r of rows) out.push(await this.db.upsert(table, r));
    return out;
  }

  @Delete('master/:table/:id')
  async remove(@Req() req: any, @Param('table') t: string, @Param('id') id: string) {
    const table = tableOf(t);
    const key = table === 'subsectors' ? 'id' : TABLES[table][0];
    await this.db.q(`DELETE FROM ${table} WHERE ${key}::text=$1`, [id]);
    if (table === 'foremen') await this.db.q('UPDATE subsectors SET foreman_id=NULL WHERE foreman_id=$1', [id]);
    return { ok: true };
  }

  @Post('reports')
  async create(@Body() r: any, @Req() req?: any) {
    if (req?.user?.role === 'foreman' && !['Draft', 'Sent'].includes(r.status)) r.status = 'Draft';
    this.check(r);
    const { rows } = await this.db.q(
      `INSERT INTO reports (foreman_id,date,shift_start,shift_end,status,labour_rows,vehicle_blocks,bin_rows)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *, to_char(date,'YYYY-MM-DD') AS date`,
      [r.foremanId, r.date, r.shiftStart || '', r.shiftEnd || '', r.status || 'Draft',
       JSON.stringify(arr(r.labourRows)), JSON.stringify(arr(r.vehicleBlocks)), JSON.stringify(arr(r.binRows))]);
    return camelRow(rows[0]);
  }

  // Partial update: any subset of the report fields (e.g. {status:'Sent'}).
  @Put('reports/:id')
  async update(@Req() req: any, @Param('id') id: string, @Body() r: any) {
    await this.own(req, id);
    if (req.user.role === 'foreman' && r.status && !['Draft', 'Sent'].includes(r.status)) delete r.status;
    const map: Record<string, string> = { foremanId: 'foreman_id', date: 'date', shiftStart: 'shift_start', shiftEnd: 'shift_end',
      status: 'status', labourRows: 'labour_rows', vehicleBlocks: 'vehicle_blocks', binRows: 'bin_rows' };
    const sets: string[] = [], vals: any[] = [];
    for (const [k, col] of Object.entries(map)) if (r[k] !== undefined) {
      vals.push(col.endsWith('rows') || col.endsWith('blocks') ? JSON.stringify(arr(r[k])) : r[k]);
      sets.push(`${col}=$${vals.length}`);
    }
    if (!sets.length) throw new BadRequestException('nothing to update');
    vals.push(id);
    const { rows } = await this.db.q(`UPDATE reports SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *, to_char(date,'YYYY-MM-DD') AS date`, vals);
    if (!rows[0]) throw new NotFoundException();
    return camelRow(rows[0]);
  }

  @Delete('reports/:id')
  async removeReport(@Req() req: any, @Param('id') id: string) { await this.own(req, id); await this.db.q('DELETE FROM reports WHERE id=$1', [id]); return { ok: true }; }

  /** Admin accepts or rejects a submitted report. Accepted reports are frozen for the foreman. */
  @Put('reports/:id/review')
  async review(@Req() req: any, @Param('id') id: string, @Body() b: { status: string; note?: string }) {
    admin(req);
    if (!['Accepted', 'Rejected', 'Sent'].includes(b?.status)) throw new BadRequestException('status must be Accepted, Rejected or Sent');
    const { rows } = await this.db.q(`UPDATE reports SET status=$2, review_note=$3, reviewed_at=now() WHERE id=$1 RETURNING *, to_char(date,'YYYY-MM-DD') AS date`, [id, b.status, b.note || '']);
    if (!rows[0]) throw new NotFoundException();
    return camelRow(rows[0]);
  }

  /** Foremen share one login, so ownership is not tracked; they just cannot change an accepted report. */
  private async own(req: any, id: string) {
    if (req.user.role !== 'foreman') return;
    const { rows } = await this.db.q('SELECT status FROM reports WHERE id=$1', [id]);
    if (!rows[0]) throw new NotFoundException();
    if (rows[0].status === 'Accepted') throw new ForbiddenException('Accepted reports cannot be changed');
  }

  @Get('backup') backup(@Req() req: any) { admin(req); return this.db.state(); }

  @Post('restore')
  async restore(@Req() req: any, @Body() data: any) {
    admin(req);
    if (!data || typeof data !== 'object') throw new BadRequestException('bad backup');
    // ponytail: not transactional; a failed restore leaves a partial DB. Re-run restore to fix.
    await this.db.q('TRUNCATE ' + [...Object.keys(TABLES), 'reports'].join(','));
    for (const t of Object.keys(TABLES)) for (const r of arr(data[t.replace(/_([a-z])/g, (_, c) => c.toUpperCase())]))
      await this.db.upsert(t, typeof r === 'string' ? { name: r } : r);
    for (const r of arr(data.reports)) await this.create(r);
    return { ok: true };
  }

  private check(r: any) {
    if (!r?.foremanId || !r?.date) throw new BadRequestException('foremanId and date are required');
  }
}
