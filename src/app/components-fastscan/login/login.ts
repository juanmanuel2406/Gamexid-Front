import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';
import { gsap } from 'gsap';

import { FastScanService, rolLabel } from '../../services-fastscan/fastscan-service';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrl: './login.css',
  standalone: false,
})
export class Login implements OnInit {
  email = 'admin@fastscan.com';
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

  ngOnInit(): void {
    // animación de entrada
    gsap.from('.login-card', { opacity: 0, y: 20, duration: 0.6, ease: 'power2.out' });
    gsap.from('.login-brand', { opacity: 0, x: -16, duration: 0.6, delay: 0.15, ease: 'power2.out' });
  }

  togglePassword(): void {
    this.mostrarPassword = !this.mostrarPassword;
  }

  ingresar(): void {
    this.errorMsg = '';
    if (!this.email.trim() || this.password.length < 4) {
      this.errorMsg = 'Completá el email y una contraseña de al menos 4 caracteres.';
      this.cdr.detectChanges();
      return;
    }
    this.cargando = true;
    this.service.login(this.email, this.password).subscribe({
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
        this.errorMsg = err.error?.mensaje || 'Error al conectar con el servidor.';
        this.cdr.detectChanges();
      },
    });
  }
}
