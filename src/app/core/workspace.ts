import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { timeout } from 'rxjs';
import { GamexidService, Branch, User, rolLabel } from '../services-gamexid/gamexid-service';
import { MessageService } from 'primeng/api';

export type ServiceState = 'checking' | 'ok' | 'down' | 'pending';

@Injectable({ providedIn: 'root' })
export class Workspace {
  private api = inject(HttpClient);
  private data = inject(GamexidService);
  private messages = inject(MessageService);
  readonly branches = signal<Branch[]>([]);
  readonly branchId = signal(0);
  readonly connection = signal<'checking' | 'online' | 'offline'>('checking');
  readonly database = signal<ServiceState>('checking');
  readonly pdfPig = signal(false);
  readonly gamingCity = signal<ServiceState>('checking');
  readonly user = signal<User | null>(this.readUser());
  readonly role = computed(() => rolLabel(this.user()?.role || ''));
  readonly isAdmin = computed(() => this.user()?.role === 'Administrator');
  readonly initials = computed(() =>
    (this.user()?.fullName || 'Operador')
      .split(/\s+/)
      .map((s) => s[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
  );
  readonly branch = computed(() => this.branches().find((b) => b.id === this.branchId()));
  readonly depot = computed(() => this.branches().find((b) => b.code === 'DEP-CENTRAL'));

  constructor() {
    this.branchId.set(Number(sessionStorage.getItem('gx_branch')) || 0);
  }
  private readUser(): User | null {
    try {
      return JSON.parse(sessionStorage.getItem('userData') || 'null');
    } catch {
      return null;
    }
  }
  setUser(user: User | null) {
    this.user.set(user);
    if (user) {
      sessionStorage.setItem('usuario', user.fullName);
      sessionStorage.setItem('userData', JSON.stringify(user));
    } else {
      sessionStorage.removeItem('usuario');
      sessionStorage.removeItem('userData');
    }
  }
  refreshBranches() {
    this.data.getSucursales().subscribe({
      next: (items) => {
        this.branches.set(items.filter((b) => b.isActive || b.isLegacy));
        const saved = Number(sessionStorage.getItem('gx_branch'));
        const preferred = this.user()?.branchId;
        this.branchId.set(
          this.branches().some((b) => b.id === saved)
            ? saved
            : this.branches().some((b) => b.id === preferred)
              ? preferred!
              : this.data.getDeposito().id,
        );
      },
      error: () => this.connection.set('offline'),
    });
  }
  select(id: number) {
    if (this.branches().some((b) => b.id === id)) {
      this.branchId.set(id);
      sessionStorage.setItem('gx_branch', String(id));
    }
  }
  refreshStatus() {
    if (!this.branches().length) this.refreshBranches();
    this.api
      .get<{ status?: string; database?: string }>('/api/access/health')
      .pipe(timeout(5000))
      .subscribe({
        next: (r) => {
          this.connection.set(r?.status === 'ok' ? 'online' : 'offline');
          this.database.set(r?.database === 'connected' ? 'ok' : 'down');
        },
        error: (e) => {
          // 503 means the API answered but MySQL is not ready.
          this.connection.set(e?.status === 503 ? 'online' : 'offline');
          this.database.set('down');
        },
      });
    this.api
      .get<{ pdfPig: boolean }>('/api/access/integrations')
      .pipe(timeout(5000))
      .subscribe({
        next: (s) => this.pdfPig.set(s.pdfPig === true),
        error: () => this.pdfPig.set(false),
      });
    this.api
      .get<{ configured: boolean }>('/api/access/gc/status')
      .pipe(timeout(5000))
      .subscribe({
        next: (s) => this.gamingCity.set(s.configured ? 'ok' : 'pending'),
        error: () => this.gamingCity.set('down'),
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
