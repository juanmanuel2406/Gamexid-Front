import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { finalize } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NetActivity {
  readonly pending = signal(0);
  readonly busy = computed(() => this.pending() > 0);
  start() { this.pending.update(n => n + 1); }
  end() { this.pending.update(n => Math.max(0, n - 1)); }
}

export const netActivityInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/')) return next(request);
  const net = inject(NetActivity);
  net.start();
  return next(request).pipe(finalize(() => net.end()));
};
