import * as XLSX from 'xlsx';
import { Api, Report, binCount, vehicleCount } from './api';

/** Export reports as a 4-sheet workbook (Labour, Vehicles, Bins, Summary) — same layout as the original app. */
export function exportExcel(api: Api, reports: Report[], from = '', to = '') {
  const labour: any[] = [], vehicles: any[] = [], bins: any[] = [], summary: any[] = [];
  for (const r of reports) {
    const fname = api.foreman(r.foremanId)?.name || 'Unknown';
    const k = api.kpi(r.foremanId, r.labourRows);
    for (const lr of r.labourRows) labour.push({ Date: r.date, Foreman: fname, 'Shift Start': r.shiftStart, 'Shift End': r.shiftEnd, Route: lr.routeRef || '', ID: lr.labourId || '',
      Name: api.labourer(lr.labourId)?.name || '', Attendance: lr.attendance || 'Present', Brush: lr.brush ? 'Yes' : '', Shovel: lr.shovel ? 'Yes' : '', Picker: lr.picker ? 'Yes' : '', Chart: lr.chart ? 'Yes' : '' });
    for (const vb of r.vehicleBlocks) {
      const base = { Date: r.date, Foreman: fname, 'Fleet ID': vb.fleetId || '', Type: vb.vehicleType || '', Task: vb.taskName || '', From: vb.from || '', To: vb.to || '', 'Driver ID': vb.driverId || '', Driver: api.driver(vb.driverId)?.name || '' };
      if (!vb.labourerRows?.length) vehicles.push({ ...base, 'Labourer ID': '', Labourer: '' });
      else for (const lr of vb.labourerRows) vehicles.push({ ...base, 'Labourer ID': lr.labourId || '', Labourer: api.labourer(lr.labourId)?.name || '' });
    }
    for (const b of r.binRows) bins.push({ Date: r.date, Foreman: fname, 'Bin Ref': b.binRef || '', Location: b.location || '', Problem: b.problemType || '' });
    summary.push({ Date: r.date, Foreman: fname, 'Shift Start': r.shiftStart, 'Shift End': r.shiftEnd, Expected: k.expected, Present: k.present, Absent: k.absent, Sick: k.sick, Leave: k.leave,
      'Attendance %': k.attendancePct + '%', Vehicles: vehicleCount(r), 'Broken Bins': binCount(r), Status: r.status || 'Draft' });
  }
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of [['Labour', labour], ['Vehicles', vehicles], ['Bins', bins], ['Summary', summary]] as const) {
    const ws = XLSX.utils.json_to_sheet(rows);
    if (rows.length) ws['!cols'] = Object.keys(rows[0]).map(k => ({ wch: Math.min(40, Math.max(k.length, ...rows.map(r => String(r[k] ?? '').length)) + 2) }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  XLSX.writeFile(wb, `Foreman_Reports_${from || 'all'}_${to || 'all'}.xlsx`);
}

export async function readSheet(file: File): Promise<Record<string, any>[]> {
  const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
}
