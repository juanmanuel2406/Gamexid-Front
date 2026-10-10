import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { finalize, tap } from 'rxjs';

export interface RequestTrace {
  method: string;
  path: string;
  status: number;
  ms: number;
}

/** Tracks real HTTP traffic to /api so the shell can show a load bar and the last request. */
@Injectable({ providedIn: 'root' })
export class NetActivity {
  readonly pending = signal(0);
  readonly last = signal<RequestTrace | null>(null);
  readonly busy = computed(() => this.pending() > 0);
  start() {
    this.pending.update((n) => n + 1);
  }
  end(trace: RequestTrace) {
    this.pending.update((n) => Math.max(0, n - 1));
    this.last.set(trace);
  }
}

export const netActivityInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/')) return next(request);
  const net = inject(NetActivity);
  const started = performance.now();
  let status = 0;
  net.start();
  return next(request).pipe(
    tap({
      next: (event) => {
        if (event instanceof HttpResponse) status = event.status;
      },
      error: (error: unknown) => {
        status = error instanceof HttpErrorResponse ? error.status : 0;
      },
    }),
    finalize(() =>
      net.end({
        method: request.method,
        path: request.url.split('?')[0],
        status,
        ms: Math.round(performance.now() - started),
      }),
    ),
  );
};
