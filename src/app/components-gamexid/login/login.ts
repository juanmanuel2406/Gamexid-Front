import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GamexidLogo } from '../../shared/logo';
import { Icon } from '../../shared/icon';
import { GamexidService } from '../../services-gamexid/gamexid-service';
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, Icon, GamexidLogo],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private data = inject(GamexidService);
  private router = inject(Router);
  email = 'admin@gamexid.com';
  password = '';
  readonly visible = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
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
