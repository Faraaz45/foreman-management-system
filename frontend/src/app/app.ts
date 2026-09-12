import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from './api';
import { Dashboard } from './dashboard';
import { ReportTab } from './report';
import { History } from './history';
import { Admin } from './admin';
import { Review } from './review';

@Component({
  selector: 'app-root',
  imports: [FormsModule, Dashboard, ReportTab, History, Admin, Review],
  templateUrl: './app.html',
})
export class App {
  api = inject(Api);
  username = ''; password = ''; loginError = '';
  tabs = computed(() => this.api.isAdmin()
    ? [{ id: 'dashboard', icon: 'fa-chart-pie', label: 'Dashboard' }, { id: 'review', icon: 'fa-clipboard-check', label: 'Foreman Reports' }, { id: 'history', icon: 'fa-history', label: 'History' }, { id: 'admin', icon: 'fa-cog', label: 'Admin' }]
    : [{ id: 'report', icon: 'fa-edit', label: 'Report' }, { id: 'history', icon: 'fa-history', label: 'History' }, { id: 'admin', icon: 'fa-cog', label: 'Admin' }]);

  constructor() { this.api.init(); }

  async login() {
    this.loginError = '';
    try { await this.api.login(this.username, this.password); this.api.toast('Welcome, ' + this.api.user()?.username, 'success', 1500); }
    catch (e: any) { this.loginError = e.message || 'Login failed'; }
  }

  backup() {
    const blob = new Blob([JSON.stringify(this.api.state(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `foreman-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(a.href);
  }
  async restore(ev: Event) {
    const input = ev.target as HTMLInputElement; const file = input.files?.[0]; input.value = '';
    if (!file) return;
    if (!(await this.api.confirm('Restore Backup', 'This replaces ALL current data with the backup. Continue?'))) return;
    try { await this.api.restore(JSON.parse(await file.text())); this.api.toast('Backup restored', 'success'); }
    catch (e: any) { this.api.toast('Restore failed: ' + e.message, 'error'); }
  }
  icon(t: string) { return ({ success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle' } as any)[t] || 'fa-info-circle'; }
}
