import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';
import { animate } from 'animejs';

import { FastScanService, rolLabel } from '../../services-fastscan/fastscan-service';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrl: './login.css',
  standalone: false,
})
export class Login implements AfterViewInit, OnDestroy {
  private animations: ReturnType<typeof animate>[] = [];
  email = 'admin@gamexid.com';
  password = '';
  mostrarPassword = false;
  cargando = false;
  errorMsg = '';
  lema = 'Gestión de inventario integral';

  constructor(
    private service: FastScanService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngAfterViewInit(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.animations.push(animate('.login-card', { opacity: [0, 1], translateY: [20, 0], duration: 600, ease: 'outExpo' }));
    this.animations.push(animate('.gamexid-logo', {
      opacity: [0, 1],
      scale: [0.72, 1],
      rotate: [-5, 0],
      duration: 850,
      delay: 240,
      ease: 'outElastic(1, .55)',
    }));
  }

  ngOnDestroy(): void { this.animations.forEach(animation => animation.revert()); }

  togglePassword(): void {
    this.mostrarPassword = !this.mostrarPassword;
  }

  ingresar(): void {
    if (this.cargando) return;
    this.errorMsg = '';
    const email = this.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.errorMsg = 'Ingresá un email válido.';
      this.cdr.detectChanges();
      return;
    }
    if (this.password.length < 8) {
      this.errorMsg = 'La contraseña debe tener al menos 8 caracteres.';
      this.cdr.detectChanges();
      return;
    }
    this.cargando = true;
    this.service.login(email, this.password).subscribe({
      next: (user) => {
        sessionStorage.setItem('logueado', 'true');
        sessionStorage.setItem('usuario', user.fullName);
        sessionStorage.setItem(
          'userData',
          JSON.stringify({ role: user.role, userId: user.id })
        );
        this.cargando = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err: any) => {
        this.cargando = false;
        this.errorMsg = err.status === 429 ? 'Demasiados intentos. Esperá un minuto y volvé a intentar.' : err.error?.mensaje || 'No se pudo iniciar sesión. Revisá la conexión e intentá nuevamente.';
        this.cdr.detectChanges();
      },
    });
  }
}
