import { Component, AfterViewInit, OnDestroy, inject, signal, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { animate } from 'animejs';
import { Icon } from '../../shared/icon';
import { FastScanService } from '../../services-fastscan/fastscan-service';
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, Icon],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements AfterViewInit, OnDestroy {
  private data = inject(FastScanService);
  private router = inject(Router);
  private host = inject(ElementRef);
  private motion?: ReturnType<typeof animate>;
  email = 'admin@gamexid.com';
  password = '';
  readonly visible = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  ngAfterViewInit() {
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
      this.motion = animate(this.host.nativeElement.querySelector('.gamexid-logo'), {
        opacity: [0, 1],
        scale: [0.94, 1],
        translateY: [8, 0],
        duration: 650,
        ease: 'outExpo',
      });
  }
  ngOnDestroy() {
    this.motion?.revert();
  }
  ingresar() {
    if (this.busy()) return;
    this.error.set('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim())) {
      this.error.set('Ingresá un email válido.');
      return;
    }
    if (this.password.length < 8) {
      this.error.set('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    this.busy.set(true);
    this.data.login(this.email.trim().toLowerCase(), this.password).subscribe({
      next: (u) => {
        sessionStorage.setItem('usuario', u.fullName);
        sessionStorage.setItem('userData', JSON.stringify(u));
        this.password = '';
        this.busy.set(false);
        this.router.navigateByUrl('/dashboard');
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(
          e.status === 429
            ? 'Demasiados intentos. Esperá un minuto.'
            : e.error?.mensaje || 'No se pudo iniciar sesión. Revisá la conexión.',
        );
      },
    });
  }
}
