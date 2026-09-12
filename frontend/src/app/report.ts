import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ATTENDANCE, Api, BinRow, LabourRow, MAX_LABOUR_ROWS, Report, VehicleBlock, attClass, today, uid } from './api';
import { exportExcel } from './excel';

const DRAFT_KEY = 'foreman_draft_v3';
const newRow = (): LabourRow => ({ routeRef: '', labourId: '', attendance: 'Present', brush: false, shovel: false, picker: false, chart: false });
const newVehicle = (): VehicleBlock => ({ id: uid(), fleetId: '', vehicleType: '', taskName: '', from: '', to: '', driverId: '', labourerRows: [] });
const newBin = (): BinRow => ({ id: uid(), binRef: '', location: '', problemType: '' });

@Component({
  selector: 'app-report',
  imports: [FormsModule],
  template: `
@if (draft(); as d) {
  <div style="background:#eaf3f3;padding:10px 14px;border-radius:var(--radius);margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
    <span><i class="fas fa-file-alt" style="color:var(--cyan);"></i> Unsaved draft from {{ d.time }}</span>
    <div style="display:flex;gap:6px;">
      <button class="btn btn-sm btn-success" (click)="restoreDraft()"><i class="fas fa-check"></i> Restore</button>
      <button class="btn btn-sm btn-outline" (click)="discardDraft()"><i class="fas fa-times"></i> Discard</button>
    </div>
  </div>
}
<div class="section-card foreman-header">
  <div class="form-row-2">
    <div class="form-group"><label>Foreman <span class="req">*</span></label>
      <select class="form-control" [ngModel]="foremanId()" (ngModelChange)="foremanChanged($event)">
        <option value="">— Select —</option>
        @for (f of api.state().foremen; track f.id) { <option [value]="f.id">{{ f.name }} ({{ f.sectorId || '—' }}) - {{ api.subsectorsByForeman(f.id).length }} subsectors</option> }
      </select></div>
    <div class="form-group"><label>Foreman ID</label><input type="text" class="form-control" readonly placeholder="Auto" [value]="foreman()?.id || ''" /></div>
  </div>
  <div class="form-row-3">
    <div class="form-group"><label>Sector ID</label><input type="text" class="form-control" readonly placeholder="Auto" [value]="foreman()?.sectorId || ''" /></div>
    <div class="form-group"><label>Subsector(s)</label><input type="text" class="form-control" readonly placeholder="Auto" [value]="subNames()" /></div>
    <div class="form-group"><label>N° Subsectors</label><input type="number" class="form-control" readonly placeholder="Auto" [value]="foremanId() ? subs().length : ''" /></div>
  </div>
  <div class="form-row-3" style="margin-top:6px;">
    <div class="form-group"><label>Report Date <span class="req">*</span></label><input type="date" class="form-control" [(ngModel)]="date" (ngModelChange)="saveDraft()" /></div>
    <div class="form-group"><label>Shift Start <span class="req">*</span></label><input type="time" class="form-control" [(ngModel)]="shiftStart" (ngModelChange)="saveDraft()" /></div>
    <div class="form-group"><label>Shift End <span class="req">*</span></label><input type="time" class="form-control" [(ngModel)]="shiftEnd" (ngModelChange)="saveDraft()" /></div>
  </div>
</div>

<div class="kpi-banner">
  <div class="kpi-item"><div class="kpi-label">Expected</div><div class="kpi-value">{{ kpi().expected }}</div></div>
  <div class="kpi-item"><div class="kpi-label">Present</div><div class="kpi-value">{{ kpi().present }}</div></div>
  <div class="kpi-item"><div class="kpi-label">Absent</div><div class="kpi-value">{{ kpi().absent }}</div></div>
  <div class="kpi-item"><div class="kpi-label">Sick</div><div class="kpi-value">{{ kpi().sick }}</div></div>
  <div class="kpi-item"><div class="kpi-label">Leave</div><div class="kpi-value">{{ kpi().leave }}</div></div>
  <div class="kpi-item"><div class="kpi-label">Attendance</div><div class="kpi-value" [class]="'kpi-value ' + (foremanId() ? cls(kpi().attendancePct) : '')">{{ kpi().attendancePct }}%</div></div>
</div>

<div class="section-card">
  <h2><i class="fas fa-users"></i> Labour Sweeping <span class="badge-count">({{ rows().length }} rows)</span></h2>
  <div class="count-info"><span><span class="label">Routes:</span> <span class="num">{{ subs().length }}</span></span><span><span class="label">Cleaners:</span> <span class="num">{{ rows().length }}</span></span></div>
  <div class="labour-table-view"><div class="table-wrap">
    <table><thead><tr><th style="min-width:80px;">Route</th><th style="min-width:80px;">ID</th><th style="min-width:80px;">Name</th><th style="min-width:100px;">Attendance</th><th style="width:50px;text-align:center;">Brush</th><th style="width:50px;text-align:center;">Shovel</th><th style="width:50px;text-align:center;">Picker</th><th style="width:50px;text-align:center;">Chart</th></tr></thead>
    <tbody>
      @for (r of rows(); track $index) {
        <tr>
          <td><select class="form-control" style="min-width:80px;" [(ngModel)]="r.routeRef" (ngModelChange)="touch()"><option value="">—</option>@for (rt of routes(); track rt) {<option [value]="rt">{{ rt }}</option>}</select></td>
          <td><select class="form-control" [(ngModel)]="r.labourId" (ngModelChange)="touch()"><option value="">—</option>@for (l of api.state().labourers; track l.id) {<option [value]="l.id">{{ l.id }}</option>}</select></td>
          <td><input type="text" class="form-control" readonly placeholder="Auto" style="background:#f1f5f5;font-size:12px;" [value]="api.labourer(r.labourId)?.name || ''" /></td>
          <td><select class="form-control" style="min-width:100px;font-size:12px;" [(ngModel)]="r.attendance" (ngModelChange)="touch()">@for (a of attendance; track a) {<option [value]="a">{{ a }}</option>}</select></td>
          <td style="text-align:center;"><input type="checkbox" [(ngModel)]="r.brush" (ngModelChange)="touch()" /></td>
          <td style="text-align:center;"><input type="checkbox" [(ngModel)]="r.shovel" (ngModelChange)="touch()" /></td>
          <td style="text-align:center;"><input type="checkbox" [(ngModel)]="r.picker" (ngModelChange)="touch()" /></td>
          <td style="text-align:center;"><input type="checkbox" [(ngModel)]="r.chart" (ngModelChange)="touch()" /></td>
        </tr>
      }
    </tbody></table>
  </div></div>
  <div class="labour-card-view">
    @for (r of rows(); track $index) {
      <div class="labour-card">
        <div class="lc-row"><span class="lc-label">{{ r.labourId || '—' }}</span><span class="lc-value">{{ api.labourer(r.labourId)?.name || '—' }}</span><span class="lc-label">Route: {{ r.routeRef || '—' }}</span></div>
        <div class="lc-row lc-attendance"><span class="lc-label">Attendance:</span>
          <select style="font-size:13px;padding:4px 8px;border-radius:6px;border:1px solid var(--gris);background:var(--blanco);min-width:100px;" [(ngModel)]="r.attendance" (ngModelChange)="touch()">@for (a of attendance; track a) {<option [value]="a">{{ a }}</option>}</select></div>
        <div class="lc-tools">
          <label><input type="checkbox" [(ngModel)]="r.brush" (ngModelChange)="touch()" /> <span class="tool-label">Brush</span></label>
          <label><input type="checkbox" [(ngModel)]="r.shovel" (ngModelChange)="touch()" /> <span class="tool-label">Shovel</span></label>
          <label><input type="checkbox" [(ngModel)]="r.picker" (ngModelChange)="touch()" /> <span class="tool-label">Picker</span></label>
          <label><input type="checkbox" [(ngModel)]="r.chart" (ngModelChange)="touch()" /> <span class="tool-label">Chart</span></label>
        </div>
      </div>
    }
  </div>
  <div class="table-actions">
    <button class="btn btn-sm btn-outline" (click)="addRow()"><i class="fas fa-plus"></i> Add</button>
    <button class="btn btn-sm btn-outline" (click)="removeRow()"><i class="fas fa-minus"></i> Remove</button>
    <span class="text-muted" style="margin-left:4px;font-size:11px;">(max {{ max }})</span>
    <span class="text-muted" style="margin-left:auto;font-size:11px;">{{ rows().length }} rows</span>
  </div>
</div>

<div class="section-card">
  <h2><i class="fas fa-truck"></i> Vehicles</h2>
  @for (v of vehicles(); track v.id; let i = $index) {
    <div class="vehicle-block">
      <div class="vehicle-header"><h4><i class="fas fa-truck"></i> Vehicle #{{ i + 1 }}</h4><button class="btn btn-sm btn-danger" (click)="removeVehicle(v)"><i class="fas fa-trash"></i></button></div>
      <div class="form-row-2">
        <div class="form-group"><label>Fleet ID</label><input type="text" class="form-control" placeholder="e.g. V-123" [(ngModel)]="v.fleetId" (ngModelChange)="touch()" /></div>
        <div class="form-group"><label>Vehicle Type</label><select class="form-control" [(ngModel)]="v.vehicleType" (ngModelChange)="touch()"><option value="">—</option>@for (t of api.state().vehicleTypes; track t) {<option [value]="t">{{ t }}</option>}</select></div>
      </div>
      <div class="form-row-2">
        <div class="form-group"><label>Task</label><input type="text" class="form-control" placeholder="e.g. Collection" [(ngModel)]="v.taskName" (ngModelChange)="touch()" /></div>
        <div class="form-row-2" style="grid-template-columns:1fr 1fr;">
          <div class="form-group"><label>From</label><input type="time" class="form-control" [(ngModel)]="v.from" (ngModelChange)="touch()" /></div>
          <div class="form-group"><label>To</label><input type="time" class="form-control" [(ngModel)]="v.to" (ngModelChange)="touch()" /></div>
        </div>
      </div>
      <hr style="border-top:1px dashed var(--gris);margin:8px 0;" />
      <div style="font-weight:600;font-size:13px;margin-bottom:4px;color:var(--verde);">Driver &amp; Labourers</div>
      <div class="vehicle-crew">
        <div class="crew-row driver-row">
          <div class="form-group"><label>Driver ID</label><select class="form-control" style="font-size:13px;" [(ngModel)]="v.driverId" (ngModelChange)="touch()"><option value="">—</option>@for (d of api.state().drivers; track d.id) {<option [value]="d.id">{{ d.id }}</option>}</select></div>
          <div class="form-group"><label>Name</label><input type="text" class="form-control" readonly style="background:#f1f5f5;font-size:13px;" [value]="api.driver(v.driverId)?.name || ''" /></div>
        </div>
        @for (lr of v.labourerRows; track $index; let j = $index) {
          <div class="crew-row">
            <div class="form-group"><label>Labourer ID</label><select class="form-control" style="font-size:13px;" [(ngModel)]="lr.labourId" (ngModelChange)="touch()"><option value="">—</option>@for (l of api.state().labourers; track l.id) {<option [value]="l.id">{{ l.id }}</option>}</select></div>
            <div class="form-group"><label>Name</label><input type="text" class="form-control" readonly style="background:#f1f5f9;font-size:13px;" [value]="api.labourer(lr.labourId)?.name || ''" /></div>
            <button class="btn btn-xs btn-danger" (click)="v.labourerRows.splice(j, 1); touch()"><i class="fas fa-times"></i></button>
          </div>
        }
      </div>
      <button class="btn btn-sm btn-outline" (click)="v.labourerRows.push({ labourId: '' }); touch()"><i class="fas fa-plus"></i> Add Labourer</button>
    </div>
  }
  <button class="btn btn-primary" (click)="addVehicle()"><i class="fas fa-plus"></i> Add Vehicle</button>
</div>

<div class="section-card">
  <h2><i class="fas fa-trash-alt"></i> Broken Bins</h2>
  @for (b of bins(); track b.id) {
    <div class="bin-row">
      <div class="form-group" style="margin-bottom:0;"><label style="font-size:11px;">Bin Ref</label><input type="text" class="form-control" placeholder="e.g. B-001" style="font-size:13px;" [(ngModel)]="b.binRef" (ngModelChange)="touch()" /></div>
      <div class="form-group" style="margin-bottom:0;"><label style="font-size:11px;">Location</label><div class="location-group"><input type="text" class="form-control" placeholder="Street or GPS" style="font-size:13px;" [(ngModel)]="b.location" (ngModelChange)="touch()" /><button class="btn btn-xs btn-primary" (click)="gps(b)" title="Get GPS" [disabled]="gpsBusy() === b.id"><i class="fas" [class]="'fas ' + (gpsBusy() === b.id ? 'fa-spinner fa-spin' : 'fa-location-dot')"></i></button></div></div>
      <div class="form-group" style="margin-bottom:0;"><label style="font-size:11px;">Problem</label><select class="form-control" style="font-size:13px;" [(ngModel)]="b.problemType" (ngModelChange)="touch()"><option value="">—</option>@for (p of api.state().problemTypes; track p) {<option [value]="p">{{ p }}</option>}</select></div>
      <button class="btn btn-xs btn-danger" style="margin-top:4px;" (click)="removeBin(b)"><i class="fas fa-times"></i></button>
    </div>
  }
  <button class="btn btn-primary" (click)="addBin()"><i class="fas fa-plus"></i> Add Bin</button>
</div>

<div class="sticky-save-bar">
  <button class="btn btn-success" (click)="save()" [disabled]="!foremanId()"><i class="fas fa-save"></i> {{ editingId() ? 'Update Report' : 'Save Report' }}</button>
  <button class="btn btn-outline" (click)="review()"><i class="fas fa-paper-plane"></i> Review &amp; Send</button>
  <button class="btn btn-outline" (click)="reset()"><i class="fas fa-undo"></i> Reset</button>
</div>

@if (reviewing()) {
  <div class="modal-overlay open" (click)="reviewing.set(false)">
    <div class="modal-box" (click)="$event.stopPropagation()">
      <h3><i class="fas fa-file-alt" style="color:var(--cyan);"></i> Review Report</h3>
      <div style="margin-bottom:8px;font-size:15px;font-weight:600;color:var(--verde);">{{ foreman()?.name }} — {{ date }}</div>
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">Shift: {{ shiftStart }} – {{ shiftEnd }}</div>
      <div class="review-grid">
        <span class="review-label">Expected</span><span class="review-value">{{ kpi().expected }}</span>
        <span class="review-label">Present</span><span class="review-value att-good">{{ kpi().present }}</span>
        <span class="review-label">Absent</span><span class="review-value" style="color:var(--rojo);">{{ kpi().absent }}</span>
        <span class="review-label">Sick</span><span class="review-value" style="color:var(--cadmio);">{{ kpi().sick }}</span>
        <span class="review-label">Leave</span><span class="review-value" style="color:var(--azul);">{{ kpi().leave }}</span>
        <span class="review-label">Attendance</span><span class="review-value" [class]="'review-value ' + cls(kpi().attendancePct)">{{ kpi().attendancePct }}%</span>
        <span class="review-label">Vehicles</span><span class="review-value">{{ vehicleCount() }}</span>
        <span class="review-label">Broken Bins</span><span class="review-value">{{ binCount() }}</span>
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:6px;"><i class="fas fa-info-circle"></i> Review before sending. Use Edit to make changes.</div>
      <div class="modal-actions" style="margin-top:10px;">
        <button class="btn btn-outline" (click)="reviewing.set(false)"><i class="fas fa-edit"></i> Edit</button>
        <button class="btn btn-success" (click)="send()"><i class="fas fa-paper-plane"></i> Send</button>
      </div>
    </div>
  </div>
}`,
})
export class ReportTab implements OnDestroy {
  api = inject(Api);
  attendance = ATTENDANCE; max = MAX_LABOUR_ROWS; cls = attClass; newVehicle = newVehicle; newBin = newBin;

  foremanId = signal(''); date = today(); shiftStart = '07:00'; shiftEnd = '15:00';
  rows = signal<LabourRow[]>([]); vehicles = signal<VehicleBlock[]>([newVehicle()]); bins = signal<BinRow[]>([newBin()]);
  editingId = signal<number | null>(null); reviewing = signal(false); gpsBusy = signal<string | null>(null);
  draft = signal<{ time: string; data: any } | null>(null);
  tick = signal(0); // bumped on any in-place row edit so computed() re-evaluates
  private timer = setInterval(() => this.saveDraft(), 5000);

  foreman = computed(() => this.api.foreman(this.foremanId()));
  subs = computed(() => this.api.subsectorsByForeman(this.foremanId()));
  subNames = computed(() => (this.foremanId() ? this.subs().map(s => s.name).join(', ') || '—' : ''));
  routes = computed(() => this.api.routesFor(this.foremanId()));
  kpi = computed(() => (this.tick(), this.api.kpi(this.foremanId(), this.rows())));
  vehicleCount = computed(() => (this.tick(), this.vehicles().filter(v => v.fleetId || v.vehicleType).length));
  binCount = computed(() => (this.tick(), this.bins().filter(b => b.binRef).length));

  constructor() {
    this.checkDraft();
    effect(() => { const r = this.api.editRequest(); if (r) { this.api.editRequest.set(null); this.loadReport(r); } });
  }
  ngOnDestroy() { clearInterval(this.timer); }
  touch() { this.tick.update(t => t + 1); this.saveDraft(); }

  foremanChanged(id: string) {
    this.foremanId.set(id);
    const rows = this.api.cleanersFor(id).map(c => ({ ...newRow(), routeRef: c.route, labourId: c.id }));
    if (!rows.length && id) {
      const any = this.api.state().labourers.find(l => this.subs().some(s => s.name === l.subsector));
      rows.push(any ? { ...newRow(), routeRef: any.route || any.subsector, labourId: any.id } : newRow());
    }
    this.rows.set(rows);
    this.saveDraft();
  }
  addRow() { if (this.rows().length >= MAX_LABOUR_ROWS) return this.api.toast(`Maximum ${MAX_LABOUR_ROWS} rows allowed.`, 'warning'); this.rows.update(r => [...r, newRow()]); this.saveDraft(); }
  removeRow() { if (this.rows().length <= 1) return this.api.toast('At least 1 row required.', 'warning'); this.rows.update(r => r.slice(0, -1)); this.touch(); }
  addVehicle() { this.vehicles.update(v => [...v, newVehicle()]); this.touch(); }
  addBin() { this.bins.update(b => [...b, newBin()]); this.touch(); }
  async removeVehicle(v: VehicleBlock) { if (await this.api.confirm('Remove Vehicle', 'Remove this vehicle?')) { this.vehicles.update(x => x.filter(b => b !== v)); this.touch(); } }
  async removeBin(b: BinRow) { if (await this.api.confirm('Remove Bin', 'Remove this bin?')) { this.bins.update(x => { const n = x.filter(y => y !== b); return n.length ? n : [newBin()]; }); this.touch(); } }

  gps(b: BinRow) {
    if (!navigator.geolocation) return this.api.toast('Geolocation not supported.', 'error');
    this.gpsBusy.set(b.id);
    navigator.geolocation.getCurrentPosition(
      p => { b.location = `${p.coords.latitude.toFixed(6)}, ${p.coords.longitude.toFixed(6)}`; this.gpsBusy.set(null); this.api.toast('Location captured!', 'success'); this.touch(); },
      e => { this.gpsBusy.set(null); this.api.toast('Unable to get location. ' + (e.code === 1 ? 'Permission denied.' : e.code === 2 ? 'Position unavailable.' : 'Timeout.'), 'error'); },
      { enableHighAccuracy: true, timeout: 8000 });
  }

  private payload(status?: string): Report {
    return { foremanId: this.foremanId(), date: this.date, shiftStart: this.shiftStart, shiftEnd: this.shiftEnd,
      status: status || 'Draft', labourRows: this.rows(), vehicleBlocks: this.vehicles(), binRows: this.bins() };
  }
  private valid() {
    if (!this.foremanId()) { this.api.toast('Select a foreman.', 'error'); return false; }
    if (!this.date || !this.shiftStart || !this.shiftEnd) { this.api.toast('Set date and shift times.', 'error'); return false; }
    return true;
  }
  async save() {
    if (!this.valid()) return;
    const id = this.editingId();
    const ok = id
      ? await this.api.run(() => this.api.updateReport(id, { ...this.payload(), status: undefined }), 'Report updated!')
      : await this.api.run(() => this.api.createReport(this.payload()), 'Report saved!');
    if (ok) this.reset();
  }
  review() { if (this.valid()) this.reviewing.set(true); }
  async send() {
    const k = this.kpi(), f = this.foreman()!, data = this.payload('Sent');
    const existing = this.editingId() ?? this.api.state().reports.find(r => r.foremanId === data.foremanId && r.date === data.date && r.status === 'Draft')?.id;
    const ok = existing
      ? await this.api.run(() => this.api.updateReport(existing, data), 'Report marked as Sent!')
      : await this.api.run(() => this.api.createReport(data), 'Report saved and marked as Sent!');
    if (!ok) return;
    this.reviewing.set(false);
    const summary = `📋 DAILY FOREMAN REPORT\n\nForeman: ${f.name}\nDate: ${data.date}\nShift: ${data.shiftStart} – ${data.shiftEnd}\n\n👥 MANPOWER\nExpected: ${k.expected}\nPresent: ${k.present}\nAbsent: ${k.absent}\nSick: ${k.sick}\nLeave: ${k.leave}\nAttendance: ${k.attendancePct}%\n\n🚛 VEHICLES\nDeployed: ${this.vehicleCount()}\n\n🗑️ BROKEN BINS\nReported: ${this.binCount()}\n\n— Sent via Foreman Daily Report`;
    const copy = () => navigator.clipboard?.writeText(summary).then(() => this.api.toast('Summary copied to clipboard. Paste it in WhatsApp, Email, etc.', 'success')).catch(() => null);
    if (navigator.share) navigator.share({ title: `Foreman Report ${data.date}`, text: summary }).catch(copy); else copy();
    const sent = this.api.state().reports.filter(r => r.foremanId === data.foremanId && r.date === data.date);
    this.reset();
    if (await this.api.confirm('Export Excel', 'Would you like to export the full report as Excel as well?')) exportExcel(this.api, sent, data.date, data.date);
  }
  reset() {
    this.foremanId.set(''); this.date = today(); this.shiftStart = '07:00'; this.shiftEnd = '15:00';
    this.rows.set([]); this.vehicles.set([newVehicle()]); this.bins.set([newBin()]); this.editingId.set(null);
    sessionStorage.removeItem(DRAFT_KEY);
  }
  loadReport(r: Report) {
    if (r.status === 'Accepted' && !this.api.isAdmin()) return this.api.toast('Accepted reports cannot be edited.', 'warning');
    this.foremanChanged(r.foremanId);
    this.date = r.date || today(); this.shiftStart = r.shiftStart || '07:00'; this.shiftEnd = r.shiftEnd || '15:00';
    if (r.labourRows?.length) this.rows.set(r.labourRows.map(x => ({ ...x })));
    this.vehicles.set(r.vehicleBlocks?.length ? r.vehicleBlocks.map(v => ({ ...v, labourerRows: (v.labourerRows || []).map(l => ({ ...l })) })) : [newVehicle()]);
    this.bins.set(r.binRows?.length ? r.binRows.map(b => ({ ...b })) : [newBin()]);
    this.editingId.set(r.id ?? null);
    this.api.toast('Editing report from ' + r.date, 'info');
  }

  // ---- draft autosave (sessionStorage, survives tab switches and reloads within the session) ----
  saveDraft() {
    if (!this.foremanId() && !this.rows().length) return;
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ timestamp: Date.now(), editingId: this.editingId(), ...this.payload() })); } catch { /* ignore */ }
  }
  private checkDraft() {
    try {
      const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
      if (!d || Date.now() - d.timestamp > 864e5) return sessionStorage.removeItem(DRAFT_KEY);
      this.draft.set({ time: new Date(d.timestamp).toLocaleTimeString(), data: d });
    } catch { /* ignore */ }
  }
  restoreDraft() { const d = this.draft()!.data; this.loadReport(d); this.editingId.set(d.editingId ?? null); this.draft.set(null); this.api.toast('Draft restored!', 'success'); }
  discardDraft() { this.draft.set(null); sessionStorage.removeItem(DRAFT_KEY); }
}
