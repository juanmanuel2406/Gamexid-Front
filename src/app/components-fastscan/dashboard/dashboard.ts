import { Component, OnInit } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import { gsap } from 'gsap';

import {
  FastScanService,
  Product,
  Branch,
  SerializedUnit,
  InventoryMovement,
} from '../../services-fastscan/fastscan-service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  standalone: false,
})
export class Dashboard implements OnInit {
  productos: Product[] = [];
  sucursales: Branch[] = [];
  unidades: SerializedUnit[] = [];
  ingresos: InventoryMovement[] = [];
  nombreUsuario = sessionStorage.getItem('usuario') || '';

  constructor(private service: FastScanService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.service.getProductos().subscribe((r) => (this.productos = r));
    this.service.getSucursales().subscribe((r) => (this.sucursales = r));
    this.service.getMovimientos().subscribe((r) => (this.ingresos = r));
    // unidades totales
    this.productos.forEach((p) =>
      this.service.getUnidadesDeProducto(p.id).subscribe((u) => {
        u.forEach((x) => this.unidades.push(x));
      })
    );
    this.cdr.detectChanges();

    setTimeout(() => {
      gsap.from('.kpi-card', { opacity: 0, y: 20, duration: 0.5, stagger: 0.1, ease: 'power2.out' });
      gsap.from('.moves-row', { opacity: 0, y: 14, duration: 0.5, delay: 0.3, ease: 'power2.out' });
    }, 50);
  }

  get unidadesActivas(): number {
    return this.unidades.filter((u) => u.status === 'Available').length;
  }

  get ingresosHoy(): number {
    const hoy = new Date().toDateString();
    return this.ingresos.filter((i) => new Date(i.createdAtUtc).toDateString() === hoy).length;
  }

  get productosActivos(): number {
    return this.productos.filter((p) => p.isActive).length;
  }

  get sucursalesActivas(): number {
    return this.sucursales.filter((s) => s.isActive).length;
  }

  fechaLegible(iso: string): string {
    const d = new Date(iso);
    const opciones: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    };
    return d.toLocaleDateString('es-AR', opciones);
  }

  totalItems(mov: InventoryMovement): number {
    return mov.items.reduce((acc, it) => acc + (it.quantity || 0), 0);
  }
}
