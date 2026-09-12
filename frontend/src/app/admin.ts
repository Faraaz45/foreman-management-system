import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from './api';
import { readSheet } from './excel';

@Component({
  selector: 'app-admin',
  imports: [FormsModule],
  template: `
<h2 style="margin-bottom:12px;color:var(--verde);font-size:17px;"><i class="fas fa-cog" style="color:var(--cyan);"></i> Manage Master Data</h2>
<div class="admin-grid">
  <!-- Foremen -->
  <div class="admin-card" style="grid-column: span 2;">
    <h3><i class="fas fa-user-tie"></i> Foremen <span class="badge-count">({{ api.state().foremen.length }})</span></h3>
    <div class="search-box" style="margin-bottom:6px;"><input type="text" class="form-control" placeholder="Search..." style="max-width:200px;" [ngModel]="foremanQ()" (ngModelChange)="foremanQ.set($event)" /><button class="btn btn-sm btn-outline" (click)="foremanQ.set('')"><i class="fas fa-times"></i></button></div>
    <div class="excel-table-wrap"><table>
      <thead><tr><th style="width:26px;">#</th><th>Sector</th><th>Subsector</th><th style="text-align:center;">Routes</th><th>ID</th><th>Foreman</th><th>Vehicle</th><th>Plate</th><th>Phone</th><th style="width:34px;"></th></tr></thead>
      <tbody>@for (f of foremen(); track f.id; let i = $index) {
        <tr><td>{{ i + 1 }}</td><td>{{ f.sectorId || '—' }}</td><td>{{ subsOf(f.id) }}</td><td style="text-align:center;">{{ f.routeCount || 0 }}</td><td>{{ f.id }}</td><td>{{ f.name }}</td><td>{{ f.vehicleBrand }}</td><td>{{ f.plateNumber }}</td><td>{{ f.phoneNumber }}</td>
        <td style="text-align:center;"><button class="btn btn-xs btn-danger" (click)="del('foremen', f.id, f.name)"><i class="fas fa-trash"></i></button></td></tr> }
      </tbody></table></div>
    <div class="table-actions"><button class="btn btn-sm btn-primary" (click)="toggle('foreman')"><i class="fas fa-plus"></i> Add</button></div>
    <div class="add-form" [class.show]="open() === 'foreman'">
      <div class="form-row-2">
        <div class="form-group"><label>Name</label><input type="text" class="form-control" [(ngModel)]="nf.name" /></div>
        <div class="form-group"><label>Sector</label><select class="form-control" [(ngModel)]="nf.sectorId"><option value="">—</option>@for (s of api.state().sectors; track s.id) {<option [value]="s.id">{{ s.id }}</option>}</select></div>
      </div>
      <div class="form-row-2">
        <div class="form-group"><label>ID</label><input type="text" class="form-control" placeholder="Auto if blank" [(ngModel)]="nf.id" /></div>
        <div class="form-group"><label>Phone</label><input type="text" class="form-control" [(ngModel)]="nf.phoneNumber" /></div>
      </div>
      <div style="display:flex;gap:6px;"><button class="btn btn-sm btn-success" (click)="addForeman()"><i class="fas fa-save"></i> Save</button><button class="btn btn-sm btn-outline" (click)="toggle('foreman')"><i class="fas fa-times"></i> Cancel</button></div>
    </div>
  </div>

  <!-- Cleaners -->
  <div class="admin-card">
    <h3><i class="fas fa-user"></i> Cleaners <span class="badge-count">({{ api.state().labourers.length }})</span></h3>
    <div class="search-box" style="margin-bottom:6px;"><input type="text" class="form-control" placeholder="Search..." style="max-width:160px;" [ngModel]="cleanerQ()" (ngModelChange)="cleanerQ.set($event)" /><button class="btn btn-sm btn-outline" (click)="cleanerQ.set('')"><i class="fas fa-times"></i></button></div>
    <div class="excel-table-wrap"><table>
      <thead><tr><th style="width:26px;">#</th><th>ID</th><th>Name</th><th>Route</th><th>Subsector</th><th style="width:34px;"></th></tr></thead>
      <tbody>@for (l of cleaners(); track l.id; let i = $index) {
        <tr><td>{{ i + 1 }}</td><td>{{ l.id }}</td><td>{{ l.name }}</td><td>{{ l.route }}</td><td>{{ l.subsector }}</td><td style="text-align:center;"><button class="btn btn-xs btn-danger" (click)="del('labourers', l.id, l.name)"><i class="fas fa-trash"></i></button></td></tr> }
      </tbody></table></div>
    <div class="table-actions"><button class="btn btn-sm btn-primary" (click)="toggle('cleaner')"><i class="fas fa-plus"></i> Add</button></div>
    <div class="add-form" [class.show]="open() === 'cleaner'">
      <div class="form-row-2">
        <div class="form-group"><label>Name</label><input type="text" class="form-control" [(ngModel)]="nc.name" /></div>
        <div class="form-group"><label>ID</label><input type="text" class="form-control" placeholder="Auto if blank" [(ngModel)]="nc.id" /></div>
      </div>
      <div class="form-row-2">
        <div class="form-group"><label>Subsector</label><select class="form-control" [(ngModel)]="nc.subsector"><option value="">—</option>@for (s of api.state().subsectors; track s.id) {<option [value]="s.name">{{ s.name }}</option>}</select></div>
        <div class="form-group"><label>Route</label><input type="text" class="form-control" placeholder="e.g. 01CN01" [(ngModel)]="nc.route" /></div>
      </div>
      <div style="display:flex;gap:6px;"><button class="btn btn-sm btn-success" (click)="addCleaner()"><i class="fas fa-save"></i> Save</button><button class="btn btn-sm btn-outline" (click)="toggle('cleaner')"><i class="fas fa-times"></i> Cancel</button></div>
    </div>
  </div>

  <!-- Drivers -->
  <div class="admin-card">
    <h3><i class="fas fa-user-cog"></i> Drivers <span class="badge-count">({{ api.state().drivers.length }})</span></h3>
    <div class="excel-table-wrap"><table><thead><tr><th style="width:26px;">#</th><th>ID</th><th>Name</th><th style="width:34px;"></th></tr></thead>
      <tbody>@for (d of api.state().drivers; track d.id; let i = $index) { <tr><td>{{ i + 1 }}</td><td>{{ d.id }}</td><td>{{ d.name }}</td><td style="text-align:center;"><button class="btn btn-xs btn-danger" (click)="del('drivers', d.id, d.name)"><i class="fas fa-trash"></i></button></td></tr> }</tbody></table></div>
    <div class="table-actions"><button class="btn btn-sm btn-primary" (click)="toggle('driver')"><i class="fas fa-plus"></i> Add</button></div>
    <div class="add-form" [class.show]="open() === 'driver'">
      <div class="form-row-2">
        <div class="form-group"><label>Name</label><input type="text" class="form-control" [(ngModel)]="nd.name" /></div>
        <div class="form-group"><label>ID</label><input type="text" class="form-control" placeholder="Auto if blank" [(ngModel)]="nd.id" /></div>
      </div>
      <div style="display:flex;gap:6px;"><button class="btn btn-sm btn-success" (click)="addDriver()"><i class="fas fa-save"></i> Save</button><button class="btn btn-sm btn-outline" (click)="toggle('driver')"><i class="fas fa-times"></i> Cancel</button></div>
    </div>
  </div>

  <!-- Vehicle Types -->
  <div class="admin-card">
    <h3><i class="fas fa-truck"></i> Vehicle Types <span class="badge-count">({{ api.state().vehicleTypes.length }})</span></h3>
    <div class="excel-table-wrap"><table><thead><tr><th style="width:26px;">#</th><th>Type</th><th style="width:34px;"></th></tr></thead>
      <tbody>@for (t of api.state().vehicleTypes; track t; let i = $index) { <tr><td>{{ i + 1 }}</td><td>{{ t }}</td><td style="text-align:center;"><button class="btn btn-xs btn-danger" (click)="del('vehicleTypes', t, t)"><i class="fas fa-trash"></i></button></td></tr> }</tbody></table></div>
    <div class="table-actions"><button class="btn btn-sm btn-primary" (click)="toggle('vtype')"><i class="fas fa-plus"></i> Add</button></div>
    <div class="add-form" [class.show]="open() === 'vtype'">
      <div class="form-group"><label>Type</label><input type="text" class="form-control" [(ngModel)]="nvt" /></div>
      <div style="display:flex;gap:6px;"><button class="btn btn-sm btn-success" (click)="addName('vehicleTypes', nvt); nvt = ''"><i class="fas fa-save"></i> Save</button><button class="btn btn-sm btn-outline" (click)="toggle('vtype')"><i class="fas fa-times"></i> Cancel</button></div>
    </div>
  </div>

  <!-- Sectors -->
  <div class="admin-card">
    <h3><i class="fas fa-building"></i> Sectors <span class="badge-count">({{ api.state().sectors.length }})</span></h3>
    <div class="excel-table-wrap"><table><thead><tr><th style="width:26px;">#</th><th>ID</th><th>Name</th><th style="width:34px;"></th></tr></thead>
      <tbody>@for (s of api.state().sectors; track s.id; let i = $index) { <tr><td>{{ i + 1 }}</td><td>{{ s.id }}</td><td>{{ s.name }}</td><td style="text-align:center;"><button class="btn btn-xs btn-danger" (click)="del('sectors', s.id, s.id)"><i class="fas fa-trash"></i></button></td></tr> }</tbody></table></div>
    <div class="table-actions"><button class="btn btn-sm btn-primary" (click)="toggle('sector')"><i class="fas fa-plus"></i> Add</button></div>
    <div class="add-form" [class.show]="open() === 'sector'">
      <div class="form-row-2">
        <div class="form-group"><label>ID</label><input type="text" class="form-control" [(ngModel)]="ns.id" /></div>
        <div class="form-group"><label>Name</label><input type="text" class="form-control" [(ngModel)]="ns.name" /></div>
      </div>
      <div style="display:flex;gap:6px;"><button class="btn btn-sm btn-success" (click)="addSector()"><i class="fas fa-save"></i> Save</button><button class="btn btn-sm btn-outline" (click)="toggle('sector')"><i class="fas fa-times"></i> Cancel</button></div>
    </div>
  </div>

  <!-- Subsectors -->
  <div class="admin-card">
    <h3><i class="fas fa-layer-group"></i> Subsectors <span class="badge-count">({{ api.state().subsectors.length }})</span></h3>
    <div class="excel-table-wrap"><table><thead><tr><th style="width:26px;">#</th><th>Sector</th><th>Subsector</th><th style="text-align:center;">Routes</th><th>Foreman</th><th style="width:34px;"></th></tr></thead>
      <tbody>@for (s of api.state().subsectors; track s.id; let i = $index) { <tr><td>{{ i + 1 }}</td><td>{{ s.sectorId }}</td><td>{{ s.name }}</td><td style="text-align:center;">{{ s.routeCount }}</td><td>{{ s.foremanId || '—' }}</td><td style="text-align:center;"><button class="btn btn-xs btn-danger" (click)="del('subsectors', s.id, s.name)"><i class="fas fa-trash"></i></button></td></tr> }</tbody></table></div>
    <div class="table-actions"><button class="btn btn-sm btn-primary" (click)="toggle('subsector')"><i class="fas fa-plus"></i> Add</button></div>
    <div class="add-form" [class.show]="open() === 'subsector'">
      <div class="form-row-2">
        <div class="form-group"><label>Sector</label><select class="form-control" [(ngModel)]="nss.sectorId"><option value="">—</option>@for (s of api.state().sectors; track s.id) {<option [value]="s.id">{{ s.id }}</option>}</select></div>
        <div class="form-group"><label>Name</label><input type="text" class="form-control" [(ngModel)]="nss.name" /></div>
      </div>
      <div class="form-row-2">
        <div class="form-group"><label># Routes</label><input type="number" class="form-control" [(ngModel)]="nss.routeCount" /></div>
        <div class="form-group"><label>Foreman</label><select class="form-control" [(ngModel)]="nss.foremanId"><option value="">—</option>@for (f of api.state().foremen; track f.id) {<option [value]="f.id">{{ f.id }} - {{ f.name }}</option>}</select></div>
      </div>
      <div style="display:flex;gap:6px;"><button class="btn btn-sm btn-success" (click)="addSubsector()"><i class="fas fa-save"></i> Save</button><button class="btn btn-sm btn-outline" (click)="toggle('subsector')"><i class="fas fa-times"></i> Cancel</button></div>
    </div>
  </div>

  <!-- Problem Types -->
  <div class="admin-card">
    <h3><i class="fas fa-exclamation-triangle"></i> Problem Types <span class="badge-count">({{ api.state().problemTypes.length }})</span></h3>
    <div class="excel-table-wrap"><table><thead><tr><th style="width:26px;">#</th><th>Type</th><th style="width:34px;"></th></tr></thead>
      <tbody>@for (t of api.state().problemTypes; track t; let i = $index) { <tr><td>{{ i + 1 }}</td><td>{{ t }}</td><td style="text-align:center;"><button class="btn btn-xs btn-danger" (click)="del('problemTypes', t, t)"><i class="fas fa-trash"></i></button></td></tr> }</tbody></table></div>
    <div class="table-actions"><button class="btn btn-sm btn-primary" (click)="toggle('ptype')"><i class="fas fa-plus"></i> Add</button></div>
    <div class="add-form" [class.show]="open() === 'ptype'">
      <div class="form-group"><label>Type</label><input type="text" class="form-control" [(ngModel)]="npt" /></div>
      <div style="display:flex;gap:6px;"><button class="btn btn-sm btn-success" (click)="addName('problemTypes', npt); npt = ''"><i class="fas fa-save"></i> Save</button><button class="btn btn-sm btn-outline" (click)="toggle('ptype')"><i class="fas fa-times"></i> Cancel</button></div>
    </div>
  </div>

  <!-- Users (admin only) -->
  @if (api.isAdmin()) {
  <div class="admin-card" style="grid-column:1/-1;">
    <h3><i class="fas fa-key"></i> Logins <span class="badge-count">({{ api.state().users?.length || 0 }})</span></h3>
    <p class="text-muted" style="font-size:12px;margin:0 0 6px;">Two shared logins: <strong>admin</strong> and <strong>foreman</strong>. Foremen pick their name in the Report form. Set a new password here.</p>
    <div class="excel-table-wrap"><table><thead><tr><th style="width:26px;">#</th><th>Username</th><th>Role</th><th style="width:34px;"></th></tr></thead>
      <tbody>@for (u of api.state().users || []; track u.username; let i = $index) { <tr><td>{{ i + 1 }}</td><td>{{ u.username }}</td><td>{{ u.role }}</td>
        <td style="text-align:center;">@if (u.username !== 'admin') { <button class="btn btn-xs btn-danger" (click)="delUser(u.username)"><i class="fas fa-trash"></i></button> }</td></tr> }</tbody></table></div>
    <div class="table-actions"><button class="btn btn-sm btn-primary" (click)="toggle('user')"><i class="fas fa-plus"></i> Add / Set Password</button></div>
    <div class="add-form" [class.show]="open() === 'user'">
      <div class="form-row-3">
        <div class="form-group"><label>Username</label><input type="text" class="form-control" [(ngModel)]="nu.username" placeholder="e.g. foreman" /></div>
        <div class="form-group"><label>Password</label><input type="text" class="form-control" [(ngModel)]="nu.password" /></div>
        <div class="form-group"><label>Role</label><select class="form-control" [(ngModel)]="nu.role"><option value="foreman">foreman</option><option value="admin">admin</option></select></div>
      </div>
      <div style="display:flex;gap:6px;"><button class="btn btn-sm btn-success" (click)="saveUser()"><i class="fas fa-save"></i> Save</button><button class="btn btn-sm btn-outline" (click)="toggle('user')"><i class="fas fa-times"></i> Cancel</button></div>
    </div>
  </div>
  }

  <!-- Import -->
  <div class="admin-card" style="grid-column:1/-1;">
    <h3><i class="fas fa-file-import"></i> Import Data from Excel</h3>
    <div class="import-section">
      @for (k of importKinds; track k.key) {
        <div class="file-row">
          <div style="flex:1;"><label style="font-size:11px;font-weight:600;">{{ k.label }} <span class="text-muted">(columns: {{ k.cols }})</span></label><input type="file" class="form-control" accept=".xlsx,.xls" (change)="files[k.key] = $any($event.target).files[0]" /></div>
          <button class="btn btn-primary btn-sm" (click)="import(k.key)"><i class="fas fa-upload"></i> Import</button>
        </div>
      }
      <div class="import-status"><span [class]="importStatus().type">{{ importStatus().msg }}</span></div>
    </div>
  </div>
</div>`,
})
export class Admin {
  api = inject(Api);
  open = signal<string | null>(null);
  foremanQ = signal(''); cleanerQ = signal('');
  importStatus = signal({ msg: '', type: '' });
  files: Record<string, File | undefined> = {};
  nf: any = {}; nc: any = {}; nd: any = {}; ns: any = {}; nss: any = {}; nu: any = { role: 'foreman' }; nvt = ''; npt = '';
  importKinds = [
    { key: 'subsectors', label: 'Subsectors', cols: 'Sector, Subsector, N Routes' },
    { key: 'foremen', label: 'Foremen', cols: 'Sector, Subsector, ID, FOREMAN, Vehicle Brand, Plate Number, Phone Number' },
    { key: 'cleaners', label: 'Cleaners', cols: 'Subsector, Routes, ID, Cleaner Name' },
    { key: 'drivers', label: 'Drivers', cols: 'ID, Name' },
  ];

  foremen = computed(() => { const q = this.foremanQ().toLowerCase(); return this.api.state().foremen.filter(f => !q || f.name.toLowerCase().includes(q) || f.id.toLowerCase().includes(q)); });
  cleaners = computed(() => { const q = this.cleanerQ().toLowerCase(); return this.api.state().labourers.filter(l => !q || l.name.toLowerCase().includes(q) || l.id.toLowerCase().includes(q) || l.route.toLowerCase().includes(q)); });
  subsOf = (id: string) => this.api.subsectorsByForeman(id).map(s => s.name).join(', ') || '—';
  toggle(k: string) { this.open.set(this.open() === k ? null : k); this.nf = {}; this.nc = {}; this.nd = {}; this.ns = {}; this.nss = {}; this.nu = { role: 'foreman' }; this.nvt = ''; this.npt = ''; }

  private genId(prefix: string) { return prefix + '_' + Date.now().toString().slice(-6); }
  private async add(table: string, row: any, label: string) { if (await this.api.run(() => (table ? this.api.upsert(table, row) : this.api.saveUser(row)), label + ' saved.')) this.open.set(null); }
  addForeman() { if (!this.nf.name?.trim()) return this.api.toast('Name is required.', 'error'); this.add('foremen', { ...this.nf, id: this.nf.id?.trim() || this.genId('UBS'), name: this.nf.name.trim() }, 'Foreman'); }
  addCleaner() { if (!this.nc.name?.trim()) return this.api.toast('Name is required.', 'error'); this.add('labourers', { ...this.nc, id: this.nc.id?.trim() || this.genId('UBW'), name: this.nc.name.trim() }, 'Cleaner'); }
  addDriver() { if (!this.nd.name?.trim()) return this.api.toast('Name is required.', 'error'); this.add('drivers', { id: this.nd.id?.trim() || this.genId('UBD'), name: this.nd.name.trim() }, 'Driver'); }
  addSector() { if (!this.ns.id?.trim()) return this.api.toast('ID is required.', 'error'); this.add('sectors', { id: this.ns.id.trim(), name: this.ns.name?.trim() || this.ns.id.trim() }, 'Sector'); }
  addSubsector() { if (!this.nss.sectorId || !this.nss.name?.trim()) return this.api.toast('Sector and name are required.', 'error'); this.add('subsectors', { ...this.nss, name: this.nss.name.trim(), routeCount: +this.nss.routeCount || 0, foremanId: this.nss.foremanId || null }, 'Subsector'); }
  addName(table: string, v: string) { if (!v?.trim()) return this.api.toast('Type is required.', 'error'); this.add(table, { name: v.trim() }, 'Type'); }
  saveUser() {
    if (!this.nu.username?.trim()) return this.api.toast('Username is required.', 'error');
    if (!this.nu.password && !(this.api.state().users || []).some(u => u.username === this.nu.username.trim())) return this.api.toast('Password is required for a new login.', 'error');
    this.add('', { ...this.nu, username: this.nu.username.trim() }, 'Login');
  }
  async delUser(u: string) { if (await this.api.confirm('Delete Login', `Delete login "${u}"?`)) this.api.run(() => this.api.deleteUser(u), 'Deleted.'); }
  async del(table: string, id: string | number, label: string) { if (await this.api.confirm('Delete', `Delete "${label}"?`)) this.api.run(() => this.api.remove(table, id), 'Deleted.'); }

  // ---- Excel import: same column names as the original app ----
  async import(kind: string) {
    const file = this.files[kind];
    if (!file) return this.importStatus.set({ msg: 'Select a file.', type: 'error' });
    this.importStatus.set({ msg: 'Processing...', type: 'info' });
    const g = (r: any, ...keys: string[]) => String(keys.map(k => r[k]).find(v => v != null) ?? '').trim();
    try {
      const json = await readSheet(file);
      const st = this.api.state();
      let count = 0, skipped = 0;
      const sectors: any[] = [], subsectors: any[] = [], rows: any[] = [];
      const ensureSector = (id: string) => { if (id && !st.sectors.some(s => s.id === id) && !sectors.some(s => s.id === id)) sectors.push({ id, name: id }); };
      const ensureSub = (sectorId: string, name: string, patch: any = {}) => {
        const cur = st.subsectors.find(s => s.name === name) || subsectors.find(s => s.name === name);
        const merged = { sectorId, name, routeCount: 0, foremanId: null, ...(cur || {}), ...patch };
        if (cur && subsectors.includes(cur)) Object.assign(cur, merged); else subsectors.push(merged);
      };
      for (const r of json) {
        if (kind === 'subsectors') {
          const sec = g(r, 'Sector', 'sector'), sub = g(r, 'Subsector', 'subsector');
          if (!sec || !sub) { skipped++; continue; }
          ensureSector(sec); ensureSub(sec, sub, { sectorId: sec, routeCount: parseInt(g(r, 'N Routes')) || 0 }); count++;
        } else if (kind === 'foremen') {
          const sec = g(r, 'Sector', 'sector'), sub = g(r, 'Subsector', 'subsector'), id = g(r, 'ID', 'id');
          if (!sec || !sub || !id) { skipped++; continue; }
          const cur = st.foremen.find(f => f.id === id);
          ensureSector(sec); ensureSub(sec, sub, { foremanId: id });
          rows.push({ ...cur, id, name: g(r, 'FOREMAN', 'foreman', 'Name') || cur?.name || '', sectorId: sec, subsector: sub,
            vehicleBrand: g(r, 'Vehicle Brand') || cur?.vehicleBrand || '', plateNumber: g(r, 'Plate Number') || cur?.plateNumber || '', phoneNumber: g(r, 'Phone Number') || cur?.phoneNumber || '' });
          count++;
        } else if (kind === 'cleaners') {
          const sub = g(r, 'Subsector', 'subsector'), id = g(r, 'ID', 'id');
          if (!sub || !id) { skipped++; continue; }
          if (!st.subsectors.some(s => s.name === sub)) { ensureSector('UNKNOWN'); ensureSub('UNKNOWN', sub); }
          const cur = st.labourers.find(l => l.id === id);
          rows.push({ id, name: g(r, 'Cleaner Name', 'Name') || cur?.name || '', subsector: sub, route: g(r, 'Routes', 'routes') || cur?.route || '' });
          count++;
        } else {
          const id = g(r, 'ID', 'id'), name = g(r, 'Name', 'name');
          if (!id || !name) { skipped++; continue; }
          rows.push({ id, name }); count++;
        }
      }
      if (sectors.length) await this.api.upsert('sectors', sectors);
      if (subsectors.length) await this.api.upsert('subsectors', subsectors);
      if (rows.length) await this.api.upsert(kind === 'cleaners' ? 'labourers' : kind, rows);
      this.importStatus.set({ msg: `✅ Imported ${count} ${kind} (${skipped} skipped)`, type: 'success' });
    } catch (e: any) { this.importStatus.set({ msg: `❌ Error: ${e.message}`, type: 'error' }); this.api.toast('Import failed.', 'error'); }
  }
}
