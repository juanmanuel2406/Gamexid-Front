import { AfterViewInit, Component, ElementRef, OnDestroy, inject, input, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription, timeout } from 'rxjs';

@Component({
  selector: 'gx-product-photo',
  standalone: true,
  template: `
    @if (image(); as url) {
      <img [src]="url" [alt]="name()" loading="lazy" decoding="async" referrerpolicy="no-referrer" (error)="image.set(null)" />
    } @else {
      <span>{{ loading() ? 'Cargando foto…' : 'Foto no disponible' }}</span>
    }
  `,
  styles: `
    :host { display: flex; align-items: center; justify-content: center; width: 128px; height: 128px;
      flex-shrink: 0; border-radius: 12px; overflow: hidden; background: var(--k-surface-2); }
    img { width: 100%; height: 100%; object-fit: contain; background: #fff; }
    span { padding: 12px; text-align: center; font-size: 12px; color: var(--k-fg-3); }
  `,
})
export class ProductPhoto implements AfterViewInit, OnDestroy {
  readonly id = input.required<string>();
  readonly name = input.required<string>();
  readonly webUrl = input<string | null>(null);
  readonly image = signal<string | null>(null);
  readonly loading = signal(false);
  private http = inject(HttpClient);
  private element = inject(ElementRef<HTMLElement>);
  private observer?: IntersectionObserver;
  private request?: Subscription;

  ngAfterViewInit() {
    if (!this.webUrl()) return;
    this.observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      this.observer?.disconnect();
      this.load();
    });
    this.observer.observe(this.element.nativeElement);
  }

  private load() {
    this.loading.set(true);
    this.request = this.http.get<{ imageUrl: string | null }>('/api/catalog/photos/' + encodeURIComponent(this.id()), {
      params: { webUrl: this.webUrl()! },
    }).pipe(timeout(30000)).subscribe({
      next: result => { this.image.set(result.imageUrl); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  ngOnDestroy() {
    this.observer?.disconnect();
    this.request?.unsubscribe();
  }
}
