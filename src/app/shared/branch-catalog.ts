import { Component, inject } from '@angular/core';
import { Catalogo } from '../components-gamexid/productos/catalogo';
import { Workspace } from '../core/workspace';
@Component({ selector: 'gx-branch-catalog', standalone: true, imports: [Catalogo], template: `
  <section class="panel" style="margin-bottom:24px;padding:20px">
    <h2>Catálogo de {{ workspace.branch()?.name }}</h2>
    <p>Productos y stock del portal en la sucursal de trabajo. Los registros propios de Gamexid se muestran por separado.</p>
    <details (toggle)="open = $any($event.target).open"><summary>Ver productos disponibles</summary>
      @if (open) { <gx-catalogo [inventory]="true" /> }
    </details>
  </section>` })
export class BranchCatalog { readonly workspace = inject(Workspace); open = false; }
