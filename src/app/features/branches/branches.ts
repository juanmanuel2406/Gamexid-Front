import { Component, ElementRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { animate } from 'animejs';
import { DialogModule } from 'primeng/dialog';
import { Branch, GamexidService } from '../../services-gamexid/gamexid-service';
import { Workspace } from '../../core/workspace';
import { InventoryStore } from '../../core/inventory-store';
import { Icon } from '../../shared/icon';
import { CountUp, enterStagger, growBars, reducedMotion, shake } from '../../shared/anim';

/** Red de sedes: stock por sede calculado desde las unidades de la API, con detalle expandible. */
@Component({
  selector: 'gx-branches',
  standalone: true,
  imports: [FormsModule, DialogModule, Icon, CountUp],
  templateUrl: './branches.html',
  styleUrl: './branches.css',
})
export class Branches {
  readonly workspace = inject(Workspace);
  readonly store = inject(InventoryStore);
  private data = inject(GamexidService);
  private host = inject(ElementRef<HTMLElement>);
  readonly selected = signal<Branch | null>(null);
  readonly creating = signal(false);
  readonly saving = signal(false);
  readonly formError = signal('');
  readonly query = signal('');
  draft = { code: '', name: '', address: '' };
  private entered = false;
  private sourceCard?: HTMLElement;

  readonly cards = computed(() => {
    const stock = this.store.stockByBranch();
    const depotId = this.workspace.depot()?.id;
    const q = this.query().trim().toLowerCase();
    const list = this.workspace
      .branches()
      .filter((b) => !q || [b.name, b.code, b.address || ''].some((v) => v.toLowerCase().includes(q)))
      .map((b) => ({ branch: b, count: stock.get(b.id) || 0, depot: b.id === depotId }));
    const max = Math.max(1, ...list.filter((c) => !c.depot).map((c) => c.count));
    return list
      .sort((a, b) => Number(b.depot) - Number(a.depot) || a.branch.name.localeCompare(b.branch.name))
      .map((c) => ({ ...c, pct: c.depot ? 100 : (c.count / max) * 100 }));
  });
  readonly units = computed(() => {
    const b = this.selected();
    if (!b) return [];
    const products = this.store.productById();
    return this.store
      .available()
      .filter((u) => u.currentBranchId === b.id)
      .map((u) => ({ ...u, product: products.get(u.productId)?.name || 'Producto #' + u.productId }))
      .sort((a, c) => a.product.localeCompare(c.product) || a.serialNumber.localeCompare(c.serialNumber));
  });

  constructor() {
    effect(() => {
      const ready = this.store.loaded() && this.workspace.branches().length > 0;
      untracked(() => {
        if (ready && !this.entered) {
          this.entered = true;
          queueMicrotask(() => {
            enterStagger(this.q('.b-card'), 0, 30);
            growBars(this.q('.b-card .gx-meter i'), 'x', 250, 25);
          });
        }
      });
    });
  }
  private q(sel: string) {
    return Array.from((this.host.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(sel));
  }

  /** Expands the clicked card into a centered panel (FLIP), then fades its content in. */
  open(branch: Branch, card: HTMLElement) {
    this.sourceCard = card;
    this.selected.set(branch);
    queueMicrotask(() => {
      const panel = this.q('.flip-panel')[0];
      if (!panel || reducedMotion()) return;
      const from = card.getBoundingClientRect();
      const to = panel.getBoundingClientRect();
      card.style.visibility = 'hidden';
      this.q('.flip-inner').forEach((e) => (e.style.opacity = '0'));
      animate(panel, {
        translateX: [from.left - to.left, 0],
        translateY: [from.top - to.top, 0],
        scaleX: [from.width / to.width, 1],
        scaleY: [from.height / to.height, 1],
        duration: 480,
        ease: 'inOutQuart',
      });
      animate(this.q('.flip-inner'), { opacity: [0, 1], duration: 250, delay: 380 });
      animate(this.q('.scrim'), { opacity: [0, 1], duration: 300 });
    });
  }
  close() {
    const panel = this.q('.flip-panel')[0];
    const card = this.sourceCard;
    const done = () => {
      this.selected.set(null);
      if (card) card.style.visibility = '';
    };
    if (!panel || !card || !card.isConnected || reducedMotion()) return done();
    const from = panel.getBoundingClientRect();
    const to = card.getBoundingClientRect();
    animate(this.q('.flip-inner'), { opacity: 0, duration: 120 });
    animate(this.q('.scrim'), { opacity: 0, duration: 350 });
    animate(panel, {
      translateX: to.left - from.left,
      translateY: to.top - from.top,
      scaleX: to.width / from.width,
      scaleY: to.height / from.height,
      duration: 420,
      delay: 80,
      ease: 'inOutQuart',
      onComplete: done,
    });
  }
  useBranch(b: Branch) {
    this.workspace.select(b.id);
    this.workspace.notify('Ahora trabajás en ' + b.name + '.', 'info');
    this.close();
  }
  openCreate() {
    this.draft = { code: '', name: '', address: '' };
    this.formError.set('');
    this.creating.set(true);
  }
  create() {
    if (this.saving()) return;
    const code = this.draft.code.trim().toUpperCase();
    const name = this.draft.name.trim();
    if (!code || !name || code.length > 20 || name.length > 120) {
      this.formError.set('Completá un código de hasta 20 caracteres y un nombre de hasta 120.');
      shake(document.querySelector('.p-dialog'));
      return;
    }
    this.saving.set(true);
    this.data.crearSucursal({ code, name, address: this.draft.address.trim() || undefined }).subscribe({
      next: (b) => {
        this.saving.set(false);
        this.creating.set(false);
        this.workspace.refreshBranches();
        this.workspace.notify('Sede ' + b.name + ' creada.');
      },
      error: (e) => {
        this.saving.set(false);
        this.formError.set(
          e.status === 403 ? 'Solo un administrador puede crear sedes.' : e.error?.mensaje || 'No se pudo crear la sede.',
        );
      },
    });
  }
}
