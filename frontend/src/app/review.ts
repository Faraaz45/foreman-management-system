import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Report, STATUSES, attClass, binCount, statusCls, vehicleCount } from './api';

@Component({
  selector: 'app-review',
  imports: [FormsModule],
  template: `
<h2 style="margin-bottom:12px;color:var(--verde);font-size:17px;"><i class="fas fa-clipboard-check" style="color:var(--cyan);"></i> Foreman Reports</h2>
<div class="section-card" style="background:#f6fafa;">
  <div class="form-row-3">
    <div class="form-group"><label>Status</label><select class="form-control" [ngModel]="status()" (ngModelChange)="status.set($event)"><option value="Sent">Pending review (Sent)</option>@for (s of statuses; track s) { @if (s !== 'Sent') {<option [value]="s">{{ s }}</option>} }<option value="">All</option></select></div>
    <div class="form-group"><label>Foreman</label><select class="form-control" [ngModel]="foreman()" (ngModelChange)="foreman.set($event)"><option value="">All</option>@for (f of api.state().foremen; track f.id) {<option [value]="f.id">{{ f.name }}</option>}</select></div>
    <div class="form-group"><label>Date</label><input type="date" class="form-control" [ngModel]="date()" (ngModelChange)="date.set($event)" /></div>
  </div>
</div>

@if (!list().length) { <div class="empty-state"><i class="fas fa-inbox"></i><h4>No reports</h4></div> }
@for (r of list(); track r.id) {
  <div class="report-item">
    <div class="report-header">
      <strong><i class="fas fa-user" style="color:var(--cyan);"></i> {{ api.foreman(r.foremanId)?.name || r.foremanId }}</strong>
      <span class="date"><i class="far fa-calendar"></i> {{ r.date }}</span>
      <span class="status-badge" [class]="'status-badge ' + cls(r.status)"><span class="status-dot" [class]="'status-dot ' + cls(r.status)"></span>{{ r.status }}</span>
    </div>
    <div class="report-summary">
      <span><i class="fas fa-clock"></i> {{ r.shiftStart }} - {{ r.shiftEnd }}</span>
      <span title="Present / Expected"><i class="fas fa-users"></i> {{ kpi(r).present }}/{{ kpi(r).expected }} <span [class]="cls2(kpi(r).attendancePct)">({{ kpi(r).attendancePct }}%)</span></span>
      <span><i class="fas fa-truck"></i> {{ vc(r) }}</span>
      <span><i class="fas fa-trash-alt"></i> {{ bc(r) }}</span>
      <button class="btn btn-xs btn-outline" (click)="openId.set(openId() === r.id ? null : r.id!)"><i class="fas" [class]="'fas ' + (openId() === r.id ? 'fa-chevron-up' : 'fa-chevron-down')"></i> Details</button>
      @if (r.status !== 'Accepted') { <button class="btn btn-xs btn-success" (click)="decide(r, 'Accepted')"><i class="fas fa-check"></i> Accept</button> }
      @if (r.status !== 'Rejected') { <button class="btn btn-xs btn-danger" (click)="decide(r, 'Rejected')"><i class="fas fa-times"></i> Reject</button> }
    </div>
    @if (r.reviewNote) { <div class="review-note"><i class="fas fa-comment"></i> {{ r.reviewNote }}</div> }
    @if (openId() === r.id) {
      <div style="margin-top:8px;">
        <div class="dash-table-wrap"><table class="detail-table"><thead><tr><th>Route</th><th>ID</th><th>Name</th><th>Attendance</th><th>Tools</th></tr></thead><tbody>
          @for (l of r.labourRows; track $index) { <tr><td>{{ l.routeRef }}</td><td>{{ l.labourId }}</td><td>{{ api.labourer(l.labourId)?.name || '' }}</td><td>{{ l.attendance }}</td><td>{{ tools(l) }}</td></tr> }
        </tbody></table></div>
        @if (vehicles(r).length) { <div class="dash-table-wrap" style="margin-top:6px;"><table class="detail-table"><thead><tr><th>Fleet</th><th>Type</th><th>Task</th><th>Time</th><th>Driver</th><th>Labourers</th></tr></thead><tbody>
          @for (v of vehicles(r); track v.id) { <tr><td>{{ v.fleetId }}</td><td>{{ v.vehicleType }}</td><td>{{ v.taskName }}</td><td>{{ v.from }}–{{ v.to }}</td><td>{{ api.driver(v.driverId)?.name || v.driverId }}</td><td>{{ crew(v) }}</td></tr> }
        </tbody></table></div> }
        @if (bins(r).length) { <div class="dash-table-wrap" style="margin-top:6px;"><table class="detail-table"><thead><tr><th>Bin</th><th>Location</th><th>Problem</th></tr></thead><tbody>
          @for (b of bins(r); track b.id) { <tr><td>{{ b.binRef }}</td><td>{{ b.location }}</td><td>{{ b.problemType }}</td></tr> }
        </tbody></table></div> }
      </div>
    }
  </div>
}

<div class="section-card" style="margin-top:16px;">
  <h2><i class="fas fa-user-clock"></i> Attendance History</h2>
  <div class="form-row-3">
    <div class="form-group"><label>Employee (cleaner)</label><input type="text" class="form-control" list="emp-list" placeholder="Type ID or name" [ngModel]="empQ()" (ngModelChange)="empQ.set($event)" />
      <datalist id="emp-list">@for (l of api.state().labourers; track l.id) {<option [value]="l.id">{{ l.name }} ({{ l.subsector }})</option>}</datalist></div>
    <div class="form-group"><label>From</label><input type="date" class="form-control" [ngModel]="from()" (ngModelChange)="from.set($event)" /></div>
    <div class="form-group"><label>To</label><input type="date" class="form-control" [ngModel]="to()" (ngModelChange)="to.set($event)" /></div>
  </div>
  @if (employee(); as e) {
    <div style="font-size:13px;margin:6px 0;"><strong>{{ e.name }}</strong> ({{ e.id }}) — {{ e.subsector }} / {{ e.route }} &nbsp;
      @for (c of attSummary(); track c[0]) { <span class="status-badge draft" style="margin-right:4px;">{{ c[0] }}: {{ c[1] }}</span> }</div>
    @if (!attendance().length) { <div class="empty-state"><i class="fas fa-calendar-xmark"></i><h4>No attendance records</h4></div> }
    @else { <div class="dash-table-wrap"><table class="detail-table"><thead><tr><th>Date</th><th>Foreman</th><th>Route</th><th>Attendance</th><th>Report status</th></tr></thead><tbody>
      @for (a of attendance(); track a.date + a.id) { <tr><td>{{ a.date }}</td><td>{{ api.foreman(a.foremanId)?.name }}</td><td>{{ a.route }}</td><td>{{ a.attendance }}</td><td><span class="status-badge" [class]="'status-badge ' + cls(a.status)">{{ a.status }}</span></td></tr> }
    </tbody></table></div> }
  } @else if (empQ()) { <div class="text-muted" style="font-size:12px;">No employee matches "{{ empQ() }}".</div> }
</div>

@if (deciding(); as d) {
  <div class="modal-overlay open" (click)="deciding.set(null)">
    <div class="modal-box" (click)="$event.stopPropagation()">
      <h3>{{ d.status === 'Accepted' ? 'Accept' : 'Reject' }} report</h3>
      <p>{{ api.foreman(d.report.foremanId)?.name }} — {{ d.report.date }}</p>
      <div class="form-group"><label>Note to foreman (optional)</label><input type="text" class="form-control" [(ngModel)]="note" /></div>
      <div class="modal-actions">
        <button class="btn btn-outline" (click)="deciding.set(null)">Cancel</button>
        <button class="btn" [class]="'btn ' + (d.status === 'Accepted' ? 'btn-success' : 'btn-danger')" (click)="confirmDecision()">{{ d.status === 'Accepted' ? 'Accept' : 'Reject' }}</button>
      </div>
    </div>
  </div>
}`,
})
export class Review {
  api = inject(Api);
  status = signal('Sent'); foreman = signal(''); date = signal('');
  openId = signal<number | null>(null);
  deciding = signal<{ report: Report; status: 'Accepted' | 'Rejected' } | null>(null); note = '';
  empQ = signal(''); from = signal(''); to = signal('');
  statuses = STATUSES; cls = statusCls; cls2 = attClass; vc = vehicleCount; bc = binCount;

  list = computed(() => this.api.state().reports.filter(r => (!this.status() || r.status === this.status()) && (!this.foreman() || r.foremanId === this.foreman()) && (!this.date() || r.date === this.date())));
  vehicles = (r: Report) => r.vehicleBlocks.filter(v => v.fleetId || v.vehicleType);
  bins = (r: Report) => r.binRows.filter(b => b.binRef);
  kpi = (r: Report) => this.api.kpi(r.foremanId, r.labourRows);
  tools = (l: any) => ['brush', 'shovel', 'picker', 'chart'].filter(k => l[k]).join(', ');
  crew = (v: any) => (v.labourerRows || []).map((x: any) => this.api.labourer(x.labourId)?.name || x.labourId).filter(Boolean).join(', ');

  employee = computed(() => { const q = this.empQ().trim().toLowerCase(); if (!q) return null; const ls = this.api.state().labourers; return ls.find(l => l.id.toLowerCase() === q) || ls.find(l => l.name.toLowerCase() === q) || ls.find(l => l.id.toLowerCase().includes(q) || l.name.toLowerCase().includes(q)) || null; });
  attendance = computed(() => {
    const e = this.employee(); if (!e) return [];
    return this.api.state().reports.filter(r => r.status !== 'Rejected' && (!this.from() || r.date >= this.from()) && (!this.to() || r.date <= this.to()))
      .flatMap(r => r.labourRows.filter(l => l.labourId === e.id).map(l => ({ id: r.id, date: r.date, foremanId: r.foremanId, route: l.routeRef, attendance: l.attendance || 'Present', status: r.status })))
      .sort((a, b) => b.date.localeCompare(a.date));
  });
  attSummary = computed(() => Object.entries(this.attendance().reduce((m: Record<string, number>, a) => (m[a.attendance] = (m[a.attendance] || 0) + 1, m), {})));

  decide(report: Report, status: 'Accepted' | 'Rejected') { this.note = ''; this.deciding.set({ report, status }); }
  async confirmDecision() {
    const d = this.deciding()!; this.deciding.set(null);
    await this.api.run(() => this.api.review(d.report.id!, d.status, this.note), `Report ${d.status.toLowerCase()}.`);
  }
}
