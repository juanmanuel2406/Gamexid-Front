import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { JsonPipe } from '@angular/common';
import { finalize, timeout } from 'rxjs';

@Component({
  standalone: true,
  imports: [FormsModule, JsonPipe],
  template: `
    <section class="space-y-6 max-w-5xl">
      <header><p class="text-violet-400 text-sm">GAMINGCITY / GC-API</p>
        <h1 class="text-3xl font-semibold mt-2">Integración empresarial</h1></header>
      <div class="border border-slate-800 rounded-xl p-6 bg-slate-900">
        <h2 class="text-xl font-medium">{{ checking() ? 'Comprobando configuración…' : configured() ? 'Credencial configurada · conexión por verificar' : 'Faltan credenciales de GamingCity' }}</h2>
        <p class="text-slate-400 mt-3">El contrato de API está incorporado. Las consultas requieren un access_token autorizado, guardado únicamente en el servidor.</p>
        <p class="text-amber-400 mt-3">Modo demostración: inventario y pedidos guardados en este navegador, sin sincronización central.</p>
        <p class="text-slate-400 mt-3">Consultas de solo lectura. No se envían altas, bajas ni cambios de stock al sistema de la empresa.</p>
      </div>
      <form (ngSubmit)="query('products')" class="flex flex-wrap items-end gap-3">
        <label class="flex-1 min-w-48">Buscar producto o EAN
          <input class="block w-full mt-2 bg-slate-900 border border-slate-700 rounded-lg p-3" name="search" [(ngModel)]="search" minlength="3" maxlength="80" placeholder="EAN o nombre del producto" />
        </label>
        <button class="rounded-lg bg-violet-600 px-5 py-3 disabled:opacity-40" [disabled]="!configured() || busy() || search.trim().length < 3">Consultar catálogo</button>
        <button type="button" class="rounded-lg border border-slate-700 px-5 py-3 disabled:opacity-40" [disabled]="!configured() || busy()" (click)="query('branches')">Consultar sucursales</button>
      </form>
      @if (error()) { <p role="alert" class="text-red-400">{{ error() }}</p> }
      @if (busy()) { <div class="animate-pulse h-32 rounded-lg bg-slate-800" role="status">Consultando GC-API…</div> }
      @if (result() !== null) {
        <section><h2 class="text-lg mb-3">Respuesta de GC-API · sin importar al inventario</h2>
          <p class="text-slate-400 mb-3">El formato de productos, EAN y seriales debe confirmarse con GamingCity antes de sincronizar registros.</p>
          <pre class="bg-slate-950 p-4 border border-slate-800 rounded-lg overflow-auto max-h-96 text-sm">{{ result() | json }}</pre>
        </section>
      }
    </section>`,
})
export class Integration {
  private http = inject(HttpClient);
  readonly configured = signal(false);
  readonly checking = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly result = signal<unknown>(null);
  search = '';
  constructor() {
    this.http.get<{ configured: boolean }>('/api/access/gc/status').pipe(timeout(5000), finalize(() => this.checking.set(false))).subscribe({
      next: (s) => this.configured.set(s.configured === true),
      error: () => this.error.set('No se pudo consultar el estado del conector.'),
    });
  }
  query(operation: 'products' | 'branches') {
    if (!this.configured() || this.busy()) return;
    if (operation === 'products' && (this.search.trim().length < 3 || this.search.trim().length > 80)) return;
    this.busy.set(true); this.error.set(''); this.result.set(null);
    this.http.get<{ data: unknown }>('/api/access/gc/' + operation, { params: operation === 'products' ? { search: this.search.trim() } : {} })
      .pipe(timeout(25000), finalize(() => this.busy.set(false))).subscribe({
        next: (r) => this.result.set(r.data),
        error: (e) => this.error.set(e.error?.mensaje || 'No se pudo completar la consulta. No se modificaron datos.'),
      });
  }
}
