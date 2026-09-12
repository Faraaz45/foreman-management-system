import { Injectable, computed, signal } from '@angular/core';

export interface Sector { id: string; name: string }
export interface Subsector { id: number; sectorId: string; name: string; routeCount: number; foremanId: string | null }
export interface Foreman { id: string; name: string; sectorId: string; subsector: string; routeCount: number; vehicleBrand: string; plateNumber: string; phoneNumber: string }
export interface Labourer { id: string; name: string; subsector: string; route: string }
export interface Driver { id: string; name: string }
export interface LabourRow { routeRef: string; labourId: string; attendance: string; brush: boolean; shovel: boolean; picker: boolean; chart: boolean }
export interface VehicleBlock { id: string; fleetId: string; vehicleType: string; taskName: string; from: string; to: string; driverId: string; labourerRows: { labourId: string }[] }
export interface BinRow { id: string; binRef: string; location: string; problemType: string }
export interface Report { id?: number; foremanId: string; date: string; shiftStart: string; shiftEnd: string; status: string; labourRows: LabourRow[]; vehicleBlocks: VehicleBlock[]; binRows: BinRow[]; reviewNote?: string; reviewedAt?: string }
export interface User { username: string; role: 'admin' | 'foreman' }
export const STATUSES = ['Draft', 'Sent', 'Accepted', 'Rejected'];
export const statusCls = (s: string) => ({ Sent: 'sent', Accepted: 'accepted', Rejected: 'rejected', 'No Report': 'pending' } as any)[s] || 'draft';
export interface State { sectors: Sector[]; subsectors: Subsector[]; foremen: Foreman[]; labourers: Labourer[]; drivers: Driver[]; vehicleTypes: string[]; problemTypes: string[]; reports: Report[]; users?: User[] }
export interface Kpi { expected: number; present: number; absent: number; sick: number; leave: number; other: number; attendancePct: number }

export const ATTENDANCE = ['Present', 'Absent', 'Sick Leave', 'Annual Leave', 'Other'];
export const MAX_LABOUR_ROWS = 27;
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const today = () => new Date().toISOString().slice(0, 10);
export const attClass = (pct: number) => (pct >= 90 ? 'att-good' : pct >= 75 ? 'att-ok' : 'att-poor');
export const vehicleCount = (r: Report) => (r.vehicleBlocks || []).filter(v => v.fleetId || v.vehicleType).length;
export const binCount = (r: Report) => (r.binRows || []).filter(b => b.binRef).length;

const EMPTY: State = { sectors: [], subsectors: [], foremen: [], labourers: [], drivers: [], vehicleTypes: [], problemTypes: [], reports: [] };

@Injectable({ providedIn: 'root' })
export class Api {
  state = signal<State>(EMPTY);
  user = signal<User | null>(null);
  isAdmin = computed(() => this.user()?.role === 'admin');
  ready = signal(false);
  tab = signal<string>('dashboard');
  editRequest = signal<Report | null>(null);
  toasts = signal<{ id: number; msg: string; type: string }[]>([]);
  confirmState = signal<{ title: string; msg: string; ok: () => void } | null>(null);

  // ---- http ----
  async req<T = any>(method: string, url: string, body?: unknown): Promise<T> {
    const r = await fetch('/api' + url, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (r.status === 401 && url !== '/login') { this.user.set(null); throw new Error('Session expired. Please log in.'); }
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || r.statusText); }
    return r.json();
  }
  async init() { try { this.setUser(await this.req<User>('GET', '/me')); await this.load(); } catch { /* not logged in */ } this.ready.set(true); }
  private setUser(u: User) { this.user.set(u); this.tab.set(u.role === 'admin' ? 'dashboard' : 'report'); }
  async login(username: string, password: string) { const u = await this.req<User>('POST', '/login', { username, password }); await this.load(); this.setUser(u); }
  async logout() { await this.req('POST', '/logout').catch(() => null); this.user.set(null); }
  async load() { this.state.set(await this.req<State>('GET', '/state')); }
  async upsert(table: string, rows: unknown) { await this.req('POST', '/master/' + table, rows); await this.load(); }
  async remove(table: string, id: string | number) { await this.req('DELETE', `/master/${table}/${encodeURIComponent(String(id))}`); await this.load(); }
  async createReport(r: Report): Promise<Report> { const out = await this.req<Report>('POST', '/reports', r); await this.load(); return out; }
  async updateReport(id: number, patch: Partial<Report>): Promise<Report> { const out = await this.req<Report>('PUT', '/reports/' + id, patch); await this.load(); return out; }
  async deleteReport(id: number) { await this.req('DELETE', '/reports/' + id); await this.load(); }
  async restore(data: unknown) { await this.req('POST', '/restore', data); await this.load(); }
  async review(id: number, status: 'Accepted' | 'Rejected' | 'Sent', note = '') { await this.req('PUT', `/reports/${id}/review`, { status, note }); await this.load(); }
  async saveUser(u: { username: string; password?: string; role: string }) { await this.req('POST', '/users', u); await this.load(); }
  async deleteUser(username: string) { await this.req('DELETE', '/users/' + encodeURIComponent(username)); await this.load(); }

  // ---- ui ----
  toast(msg: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', ms = 4000) {
    const id = Date.now() + Math.random();
    this.toasts.update(t => [...t, { id, msg, type }]);
    setTimeout(() => this.dismiss(id), ms);
  }
  dismiss(id: number) { this.toasts.update(t => t.filter(x => x.id !== id)); }
  confirm(title: string, msg: string): Promise<boolean> {
    return new Promise(res => this.confirmState.set({ title, msg, ok: () => { this.confirmState.set(null); res(true); } }));
  }
  cancelConfirm() { this.confirmState.set(null); }
  /** Run an API call, toast on failure. Returns true on success. */
  async run(fn: () => Promise<unknown>, okMsg?: string) {
    try { await fn(); if (okMsg) this.toast(okMsg, 'success'); return true; }
    catch (e: any) { this.toast(e.message || 'Request failed', 'error'); return false; }
  }

  // ---- lookups ----
  foreman(id: string) { return this.state().foremen.find(f => f.id === id); }
  labourer(id: string) { return this.state().labourers.find(l => l.id === id); }
  driver(id: string) { return this.state().drivers.find(d => d.id === id); }
  subsectorsByForeman(id: string) { return this.state().subsectors.filter(s => s.foremanId === id); }
  /** Cleaners with a route in the foreman's subsectors = expected headcount. */
  cleanersFor(foremanId: string) {
    const names = this.subsectorsByForeman(foremanId).map(s => s.name);
    return this.state().labourers.filter(l => names.includes(l.subsector) && l.route);
  }
  routesFor(foremanId: string) {
    const subs = foremanId ? this.subsectorsByForeman(foremanId) : this.state().subsectors;
    const names = subs.map(s => s.name);
    return [...new Set(this.state().labourers.filter(l => names.includes(l.subsector) && l.route).map(l => l.route))].sort();
  }
  kpi(foremanId: string, rows: LabourRow[]): Kpi {
    const expected = foremanId ? this.cleanersFor(foremanId).length : 0;
    const k = { expected, present: 0, absent: 0, sick: 0, leave: 0, other: 0, attendancePct: 0 };
    for (const r of rows) {
      const a = r.attendance || 'Present';
      if (a === 'Present') k.present++; else if (a === 'Absent') k.absent++; else if (a === 'Sick Leave') k.sick++; else if (a === 'Annual Leave') k.leave++; else k.other++;
    }
    k.attendancePct = expected ? Math.round((k.present / expected) * 100) : 0;
    return k;
  }
}
