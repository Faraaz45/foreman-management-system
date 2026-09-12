import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, attClass, binCount, statusCls, today, vehicleCount } from './api';

@Component({
  selector: 'app-dashboard',
  imports: [FormsModule],
  template: `
<h2 style="margin-bottom:10px;color:var(--verde);font-size:17px;"><i class="fas fa-chart-pie" style="color:var(--cyan);"></i> Operations Dashboard</h2>
<div class="dash-filters">
  <div class="form-group"><label>Date</label><input type="date" class="form-control" [ngModel]="date()" (ngModelChange)="date.set($event)" /></div>
  <div class="form-group"><label>Foreman</label><select class="form-control" [ngModel]="foreman()" (ngModelChange)="foreman.set($event)"><option value="">All</option>@for (f of api.state().foremen; track f.id) {<option [value]="f.id">{{ f.name }}</option>}</select></div>
  <div class="form-group"><label>Sector</label><select class="form-control" [ngModel]="sector()" (ngModelChange)="sector.set($event); subsector.set('')"><option value="">All</option>@for (s of api.state().sectors; track s.id) {<option [value]="s.id">{{ s.id }}</option>}</select></div>
  <div class="form-group"><label>Subsector</label><select class="form-control" [ngModel]="subsector()" (ngModelChange)="subsector.set($event)"><option value="">All</option>@for (s of subsectorOptions(); track s) {<option [value]="s">{{ s }}</option>}</select></div>
</div>
<div class="stats-grid">
  @for (c of cards(); track c.label) { <div class="stat-card"><div class="stat-label">{{ c.label }}</div><div class="stat-value">{{ c.value }}</div></div> }
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:6px;">
  <div class="section-card" style="grid-column:1/-1;">
    <h2><i class="fas fa-users"></i> Subsector Performance</h2>
    @if (!stats().subs.length) { <div class="empty-state"><i class="fas fa-users"></i><h4>No subsector data</h4></div> }
    @else { <div class="dash-table-wrap"><table><thead><tr><th>Subsector</th><th>Sector</th><th>Expected</th><th>Present</th><th>Absent</th><th>Sick</th><th>Leave</th><th>Attendance</th></tr></thead><tbody>
      @for (s of stats().subs; track s.subsector) { <tr><td><strong>{{ s.subsector }}</strong></td><td>{{ s.sector }}</td><td>{{ s.expected }}</td><td>{{ s.present }}</td><td>{{ s.absent }}</td><td>{{ s.sick }}</td><td>{{ s.leave }}</td><td [class]="cls(s.pct)">{{ s.pct }}%</td></tr> }
    </tbody></table></div> }
  </div>
  <div class="section-card" style="grid-column:1/-1;">
    <h2><i class="fas fa-user-tie"></i> Foreman Performance</h2>
    @if (!stats().foremen.length) { <div class="empty-state"><i class="fas fa-user-tie"></i><h4>No foreman data</h4></div> }
    @else { <div class="dash-table-wrap"><table><thead><tr><th>Foreman</th><th>Sector</th><th>Expected</th><th>Present</th><th>Attendance</th><th>Vehicles</th><th>Bins</th><th>Status</th></tr></thead><tbody>
      @for (f of stats().foremen; track f.id) { <tr><td><strong>{{ f.name }}</strong></td><td>{{ f.sector }}</td><td>{{ f.expected }}</td><td>{{ f.present }}</td><td [class]="cls(f.attPct)">{{ f.attPct }}%</td><td>{{ f.vehicles }}</td><td>{{ f.bins }}</td>
        <td><span class="status-badge" [class]="'status-badge ' + statusCls(f.status)"><span class="status-dot" [class]="'status-dot ' + statusCls(f.status)"></span>{{ f.status }}</span></td></tr> }
    </tbody></table></div> }
  </div>
  <div class="section-card">
    <h2><i class="fas fa-trash-alt"></i> Problem Analysis</h2>
    @if (!stats().problems.length) { <div class="empty-state"><i class="fas fa-check-circle"></i><h4>No problems reported</h4></div> }
    @else { <div class="dash-table-wrap"><table><thead><tr><th>Problem Type</th><th>Count</th></tr></thead><tbody>@for (p of stats().problems; track p[0]) {<tr><td>{{ p[0] }}</td><td><strong>{{ p[1] }}</strong></td></tr>}</tbody></table></div> }
  </div>
  <div class="section-card">
    <h2><i class="fas fa-truck"></i> Vehicle Deployment</h2>
    @if (!stats().vehicles.length) { <div class="empty-state"><i class="fas fa-truck"></i><h4>No vehicles deployed</h4></div> }
    @else { <div class="dash-table-wrap"><table><thead><tr><th>Vehicle Type</th><th>Count</th></tr></thead><tbody>@for (v of stats().vehicles; track v[0]) {<tr><td>{{ v[0] }}</td><td><strong>{{ v[1] }}</strong></td></tr>}</tbody></table></div> }
  </div>
</div>`,
})
export class Dashboard {
  api = inject(Api);
  date = signal(today()); foreman = signal(''); sector = signal(''); subsector = signal('');
  cls = attClass;
  statusCls = statusCls;

  subsectorOptions = computed(() => {
    const subs = this.api.state().subsectors.filter(s => !this.sector() || s.sectorId === this.sector());
    return [...new Set(subs.map(s => s.name))];
  });

  stats = computed(() => {
    const st = this.api.state();
    let reports = st.reports.filter(r => r.date === this.date());
    if (this.foreman()) reports = reports.filter(r => r.foremanId === this.foreman());
    if (this.sector()) reports = reports.filter(r => this.api.foreman(r.foremanId)?.sectorId === this.sector());
    let foremen = st.foremen;
    if (this.sector()) foremen = foremen.filter(f => f.sectorId === this.sector());
    if (this.foreman()) foremen = foremen.filter(f => f.id === this.foreman());

    const tot = { expected: 0, present: 0, absent: 0, sick: 0, leave: 0, vehicles: 0, bins: 0 };
    const subMap: Record<string, any> = {};
    const fm = foremen.map(f => {
      const report = reports.find(r => r.foremanId === f.id);
      const k = this.api.kpi(f.id, report?.labourRows || []);
      tot.expected += k.expected; tot.present += k.present; tot.absent += k.absent; tot.sick += k.sick; tot.leave += k.leave;
      if (report) { tot.vehicles += vehicleCount(report); tot.bins += binCount(report); }
      for (const s of this.api.subsectorsByForeman(f.id)) {
        const e = subMap[s.name] ||= { subsector: s.name, sector: s.sectorId, expected: 0, present: 0, absent: 0, sick: 0, leave: 0, pct: 0 };
        e.expected += st.labourers.filter(l => l.subsector === s.name && l.route).length;
        for (const lr of report?.labourRows || []) {
          if (this.api.labourer(lr.labourId)?.subsector !== s.name) continue;
          const a = lr.attendance || 'Present';
          if (a === 'Present') e.present++; else if (a === 'Absent') e.absent++; else if (a === 'Sick Leave') e.sick++; else if (a === 'Annual Leave') e.leave++;
        }
      }
      return { id: f.id, name: f.name, sector: f.sectorId || '—', expected: k.expected, present: k.present, attPct: k.attendancePct,
        vehicles: report ? vehicleCount(report) : 0, bins: report ? binCount(report) : 0, status: report ? report.status || 'Draft' : 'No Report' };
    }).sort((a, b) => a.attPct - b.attPct);

    let subs = Object.values(subMap);
    if (this.subsector()) subs = subs.filter(s => s.subsector === this.subsector());
    for (const s of subs) s.pct = s.expected ? Math.round((s.present / s.expected) * 100) : 0;
    subs.sort((a, b) => a.pct - b.pct);

    const count = (items: string[]) => Object.entries(items.reduce((m: Record<string, number>, k) => (m[k] = (m[k] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1]);
    const problems = count(reports.flatMap(r => r.binRows.map(b => b.problemType).filter(Boolean)));
    const vehicles = count(reports.flatMap(r => r.vehicleBlocks.map(v => v.vehicleType || (v.fleetId ? 'Other' : '')).filter(Boolean)));
    return { tot, subs, foremen: fm, problems, vehicles };
  });

  cards = computed(() => {
    const t = this.stats().tot;
    return [
      { label: 'Expected', value: t.expected }, { label: 'Present', value: t.present },
      { label: 'Attendance', value: (t.expected ? Math.round((t.present / t.expected) * 100) : 0) + '%' },
      { label: 'Absent', value: t.absent }, { label: 'Vehicles', value: t.vehicles }, { label: 'Broken Bins', value: t.bins },
    ];
  });
}
