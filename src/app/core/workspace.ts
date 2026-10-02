import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { timeout } from 'rxjs';
import { FastScanService, Branch } from '../services-fastscan/fastscan-service';
import { MessageService } from 'primeng/api';
@Injectable({ providedIn: 'root' })
export class Workspace {
  private api = inject(HttpClient);
  private data = inject(FastScanService);
  private messages = inject(MessageService);
  readonly branches = signal<Branch[]>([]);
  readonly branchId = signal(0);
  readonly connection = signal<'checking' | 'online' | 'offline'>('checking');
  readonly gemini = signal(false);
  constructor() {
    this.data.getDeposito();
    this.data
      .getSucursales()
      .subscribe((items) => this.branches.set(items.filter((b) => b.isActive || b.isLegacy)));
    const saved = Number(sessionStorage.getItem('gx_branch'));
    this.branchId.set(
      this.branches().some((b) => b.id === saved) ? saved : this.data.getDeposito().id,
    );
  }
  select(id: number) {
    if (this.branches().some((b) => b.id === id)) {
      this.branchId.set(id);
      sessionStorage.setItem('gx_branch', String(id));
    }
  }
  refreshStatus() {
    this.api
      .get<{ status?: string }>('/api/access/health')
      .pipe(timeout(5000))
      .subscribe({
        next: (result) => this.connection.set(result?.status === 'ok' ? 'online' : 'offline'),
        error: () => this.connection.set('offline'),
      });
    this.api
      .get<{ gemini: boolean }>('/api/access/integrations')
      .pipe(timeout(5000))
      .subscribe({
        next: (s) => this.gemini.set(s.gemini === true),
        error: () => this.gemini.set(false),
      });
  }
  notify(detail: string, severity: 'success' | 'error' | 'warn' | 'info' = 'success') {
    this.messages.add({
      severity,
      summary: {
        success: 'Operación completada',
        error: 'Revisá la operación',
        warn: 'Atención',
        info: 'Información',
      }[severity],
      detail,
      life: 6000,
    });
  }
}
