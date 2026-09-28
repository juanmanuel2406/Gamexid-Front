import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, switchMap } from 'rxjs';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { FastScanService, SerializedUnit } from '../../services-fastscan/fastscan-service';
import { Workspace } from '../../core/workspace';
import { Motion } from '../../shared/motion';
import { Icon } from '../../shared/icon';
import { Highlight } from '../../shared/highlight';
interface AuditRow extends SerializedUnit {
  component: string;
  chassis: string;
  verification: string;
}
interface Evidence {
  unitId: number;
  expected: string;
  actual: string;
  chassis: string;
  date: string;
  matches: boolean;
}
@Component({
  selector: 'gx-audit',
  standalone: true,
  imports: [
    FormsModule,
    TableModule,
    DialogModule,
    TagModule,
    TooltipModule,
    SkeletonModule,
    Icon,
    Highlight,
  ],
  templateUrl: './audit.html',
  styleUrl: './audit.css',
})
export class Audit {
  readonly workspace = inject(Workspace);
  private data = inject(FastScanService);
  private motion = inject(Motion);
  readonly rows = signal<AuditRow[]>([]);
  readonly query = signal('');
  readonly loading = signal(true);
  readonly selected = signal<AuditRow | null>(null);
  readonly linking = signal<AuditRow | null>(null);
  readonly alert = signal<Evidence | null>(null);
  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.rows().filter(
      (r) =>
        r.currentBranchId === this.workspace.branchId() &&
        [r.chassis, r.component, r.serialNumber, r.verification].some((v) =>
          v.toLowerCase().includes(q),
        ),
    );
  });
  actual = '';
  chassis = '';
  readonly formError = signal('');
  constructor() {
    this.data
      .getProductos()
      .pipe(
        switchMap((products) =>
          products.length
            ? forkJoin(
                products.map((p) =>
                  this.data
                    .getUnidadesDeProducto(p.id)
                    .pipe(
                      switchMap((units) =>
                        of(
                          units.map((u) => ({
                            ...u,
                            component: p.name,
                            chassis: '',
                            verification: 'Sin control',
                          })),
                        ),
                      ),
                    ),
                ),
              )
            : of([]),
        ),
      )
      .subscribe({
        next: (groups) => {
          try {
            const links = JSON.parse(localStorage.getItem('gx_lineage_v1') || '{}');
            const evidence: Evidence[] = JSON.parse(localStorage.getItem('gx_audit_v1') || '[]');
            this.rows.set(
              groups
                .flat()
                .map((r) => ({
                  ...r,
                  chassis: typeof links[r.id] === 'string' ? links[r.id] : '',
                  verification:
                    evidence.filter((e) => e.unitId === r.id).at(-1)?.matches === true
                      ? 'Verificado'
                      : evidence.some((e) => e.unitId === r.id)
                        ? 'Discrepancia'
                        : 'Sin control',
                })),
            );
          } catch {
            this.rows.set(groups.flat());
            this.workspace.notify('No se pudo leer el registro local de auditoría.', 'error');
          }
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.workspace.notify('No se pudieron cargar los seriales.', 'error');
        },
      });
  }
  begin(row: AuditRow) {
    this.formError.set('');
    this.actual = '';
    this.selected.set(row);
  }
  link(row: AuditRow) {
    this.formError.set('');
    this.chassis = row.chassis;
    this.linking.set(row);
  }
  saveLink() {
    const row = this.linking(),
      chassis = this.chassis.trim();
    if (!row) return;
    if (!chassis || chassis.length > 120) {
      this.formError.set('Ingresá un serial de gabinete de hasta 120 caracteres.');
      return;
    }
    try {
      const links = JSON.parse(localStorage.getItem('gx_lineage_v1') || '{}');
      if (row.chassis && row.chassis !== chassis) {
        this.formError.set(
          'Este componente ya tiene un gabinete asociado. No se modifica su linaje desde esta pantalla.',
        );
        return;
      }
      links[row.id] = chassis;
      localStorage.setItem('gx_lineage_v1', JSON.stringify(links));
      this.rows.update((rows) => rows.map((r) => (r.id === row.id ? { ...r, chassis } : r)));
      this.linking.set(null);
      this.workspace.notify('Componente asociado al gabinete en el registro local.');
    } catch {
      this.formError.set('No se pudo guardar la asociación. Revisá el espacio del navegador.');
    }
  }
  verify() {
    const row = this.selected();
    if (!row) return;
    const actual = this.actual.trim();
    if (!actual || actual.length > 120) {
      this.formError.set('Ingresá el serial observado, de hasta 120 caracteres.');
      return;
    }
    const evidence: Evidence = {
      unitId: row.id,
      expected: row.serialNumber,
      actual,
      chassis: row.chassis,
      date: new Date().toISOString(),
      matches: row.serialNumber.trim().toUpperCase() === actual.toUpperCase(),
    };
    try {
      const history: Evidence[] = JSON.parse(localStorage.getItem('gx_audit_v1') || '[]');
      localStorage.setItem('gx_audit_v1', JSON.stringify([...history, evidence]));
      this.rows.update((rows) =>
        rows.map((r) =>
          r.id === row.id
            ? { ...r, verification: evidence.matches ? 'Verificado' : 'Discrepancia' }
            : r,
        ),
      );
      this.selected.set(null);
      this.alert.set(evidence.matches ? null : evidence);
      if (evidence.matches) this.workspace.notify('Serial verificado: coincide con el registro.');
      else {
        this.workspace.notify(
          'Discrepancia detectada. Separá la unidad y revisá el registro.',
          'warn',
        );
        setTimeout(() => {
          const el = document.getElementById('fraud-alert');
          if (el) this.motion.discrepancy(el);
        });
      }
    } catch {
      this.formError.set('No se pudo guardar la verificación. No se modificó el resultado.');
    }
  }
}
