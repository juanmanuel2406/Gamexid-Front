import { Component, OnInit } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import { gsap } from 'gsap';

import { FastScanService, Branch } from '../../services-fastscan/fastscan-service';

@Component({
  selector: 'app-sucursales',
  templateUrl: './sucursales.html',
  styleUrl: './sucursales.css',
  standalone: false,
})
export class Sucursales implements OnInit {
  sucursales: Branch[] = [];
  mensaje = '';
  tipoMensaje: 'ok' | 'error' = 'ok';

  mostrarAlta = false;
  nuevoCodigo = '';
  nuevoNombre = '';
  nuevaDireccion = '';
  guardando = false;

  constructor(private service: FastScanService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.service.getSucursales().subscribe((r) => {
      this.sucursales = r;
      this.cdr.detectChanges();
      setTimeout(() => {
        gsap.from('.suc-row', { opacity: 0, y: 10, duration: 0.4, stagger: 0.05, ease: 'power2.out' });
      }, 50);
    });
  }

  notificar(mensaje: string, tipo: 'ok' | 'error'): void {
    this.mensaje = mensaje;
    this.tipoMensaje = tipo;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.mensaje = '';
      this.cdr.detectChanges();
    }, 3500);
  }

  abrirAlta(): void {
    this.mostrarAlta = true;
    this.nuevoCodigo = '';
    this.nuevoNombre = '';
    this.nuevaDireccion = '';
  }

  cerrarAlta(): void {
    this.mostrarAlta = false;
  }

  guardarSucursal(): void {
    if (!this.nuevoCodigo.trim() || !this.nuevoNombre.trim()) {
      this.notificar('Completá el código y el nombre.', 'error');
      return;
    }
    this.guardando = true;
    this.service
      .crearSucursal({
        code: this.nuevoCodigo.trim(),
        name: this.nuevoNombre.trim(),
        address: this.nuevaDireccion.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.guardando = false;
          this.cerrarAlta();
          this.notificar('Sucursal creada correctamente.', 'ok');
          this.service.getSucursales().subscribe((r) => {
            this.sucursales = r;
            this.cdr.detectChanges();
          });
        },
        error: (err: any) => {
          this.guardando = false;
          this.notificar(err.error?.mensaje || 'No se pudo crear la sucursal.', 'error');
          this.cdr.detectChanges();
        },
      });
  }
}
