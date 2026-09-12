import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Report, STATUSES, binCount, statusCls, vehicleCount } from './api';
import { exportExcel } from './excel';

@Component({
  selector: 'app-history',
  imports: [FormsModule],
  template: `
<h2 style="margin-bottom:12px;color:var(--verde);font-size:17px;"><i class="fas fa-history" style="color:var(--cyan);"></i> Saved Reports</h2>
<div class="section-card" style="background:#f6fafa;">
  <div class="form-row-3">
    <div class="form-group"><label>Search</label><input type="text" class="form-control" placeholder="Foreman name..." [ngModel]="search()" (ngModelChange)="search.set($event)" /></div>
    <div class="form-group"><label>From</label><input type="date" class="form-control" [ngModel]="from()" (ngModelChange)="from.set($event)" /></div>
    <div class="form-group"><label>To</label><input type="date" class="form-control" [ngModel]="to()" (ngModelChange)="to.set($event)" /></div>
  </div>
  <div class="form-row-3" style="margin-top:4px;">
    <div class="form-group"><label>Foreman</label><select class="form-control" [ngModel]="foreman()" (ngModelChange)="foreman.set($event)"><option value="">All</option>@for (f of api.state().foremen; track f.id) {<option [value]="f.id">{{ f.name }}</option>}</select></div>
    <div class="form-group"><label>Sector</label><select class="form-control" [ngModel]="sector()" (ngModelChange)="sector.set($event)"><option value="">All</option>@for (s of api.state().sectors; track s.id) {<option [value]="s.id">{{ s.id }}</option>}</select></div>
    <div class="form-group"><label>Status</label><select class="form-control" [ngModel]="status()" (ngModelChange)="status.set($event)"><option value="">All</option>@for (st of statuses; track st) {<option [value]="st">{{ st }}</option>}</select></div>
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">
    <button class="btn btn-success" (click)="export()"><i class="fas fa-file-excel"></i> Export Excel</button>
    <button class="btn btn-outline" (click)="clear()"><i class="fas fa-undo"></i> Clear Filters</button>
  </div>
</div>
@if (!filtered().length) { <div class="empty-state"><i class="fas fa-file-alt"></i><h4>No reports found</h4></div> }
@for (r of filtered(); track r.id) {
  <div class="report-item">
    <div class="report-header">
      <strong><i class="fas fa-user" style="color:var(--cyan);"></i> {{ api.foreman(r.foremanId)?.name || 'Unknown' }}</strong>
      <span class="date"><i class="far fa-calendar"></i> {{ r.date }}</span>
      <span class="status-badge" [class]="'status-badge ' + cls(r.status)"><span class="status-dot" [class]="'status-dot ' + cls(r.status)"></span>{{ r.status }}</span>
    </div>
    @if (r.reviewNote) { <div class="review-note"><i class="fas fa-comment"></i> Admin note: {{ r.reviewNote }}</div> }
    <div class="report-summary">
      <span><i class="fas fa-clock"></i> {{ r.shiftStart || '—' }} - {{ r.shiftEnd || '—' }}</span>
      <span><i class="fas fa-users"></i> {{ labourCount(r) }}</span>
      <span><i class="fas fa-truck"></i> {{ vc(r) }}</span>
      <span><i class="fas fa-trash-alt"></i> {{ bc(r) }}</span>
      @if (api.isAdmin() || r.status !== 'Accepted') {
        <button class="btn btn-xs btn-primary" (click)="edit(r)" title="Edit"><i class="fas fa-edit"></i></button>
        <button class="btn btn-xs btn-danger" (click)="remove(r)" title="Delete"><i class="fas fa-trash"></i></button>
      }
      @if (r.status === 'Draft' || r.status === 'Rejected') { <button class="btn btn-xs btn-success" (click)="markSent(r)" title="Submit"><i class="fas fa-paper-plane"></i></button> }
    </div>
  </div>
}`,
})
export class History {
  api = inject(Api);
  search = signal(''); from = signal(''); to = signal(''); foreman = signal(''); sector = signal(''); status = signal('');
  vc = vehicleCount; bc = binCount; cls = statusCls; statuses = STATUSES;
  labourCount = (r: Report) => r.labourRows.filter(l => l.labourId).length;

  filtered = computed(() => {
    const q = this.search().toLowerCase();
    return this.api.state().reports.filter(r => {
      const f = this.api.foreman(r.foremanId);
      return (!q || f?.name.toLowerCase().includes(q)) && (!this.from() || r.date >= this.from()) && (!this.to() || r.date <= this.to())
        && (!this.foreman() || r.foremanId === this.foreman()) && (!this.sector() || f?.sectorId === this.sector()) && (!this.status() || (r.status || 'Draft') === this.status());
    }).sort((a, b) => b.date.localeCompare(a.date));
  });

  clear() { this.search.set(''); this.from.set(''); this.to.set(''); this.foreman.set(''); this.sector.set(''); this.status.set(''); }
  export() {
    const rows = this.api.state().reports.filter(r => (!this.from() || r.date >= this.from()) && (!this.to() || r.date <= this.to()));
    if (!rows.length) return this.api.toast('No reports in date range.', 'warning');
    exportExcel(this.api, rows, this.from(), this.to());
  }
  edit(r: Report) { this.api.editRequest.set(r); this.api.tab.set('report'); }
  async remove(r: Report) { if (await this.api.confirm('Delete Report', 'Delete this report?')) this.api.run(() => this.api.deleteReport(r.id!), 'Report deleted.'); }
  markSent(r: Report) { this.api.run(() => this.api.updateReport(r.id!, { status: 'Sent' }), 'Report submitted!'); }
}
