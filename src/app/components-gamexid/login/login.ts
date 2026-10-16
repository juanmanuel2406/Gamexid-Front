import { Component, ElementRef, inject, signal, afterNextRender } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { animate, stagger } from 'animejs';
import { GxIsotype } from '../../shared/gx-isotype';
import { Icon } from '../../shared/icon';
import { GamexidService } from '../../services-gamexid/gamexid-service';
import { Workspace } from '../../core/workspace';
import { reducedMotion, shake } from '../../shared/anim';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, Icon, GxIsotype],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private data = inject(GamexidService);
  private workspace = inject(Workspace);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private host = inject(ElementRef<HTMLElement>);
  email = '';
  password = '';
  readonly visible = signal(false);
  readonly busy = signal(false);
  readonly granted = signal(false);
  readonly error = signal('');

  constructor() {
    afterNextRender(() => this.opening());
  }
  private el<T extends Element = HTMLElement>(sel: string) {
    return Array.from((this.host.nativeElement as HTMLElement).querySelectorAll<T>(sel));
  }

  private opening() {
    const curtain = this.el('.curtain')[0];
    if (!curtain) return;
    if (reducedMotion()) {
      curtain.remove();
      return;
    }
    animate(this.el('.seam i'), {
      scaleX: [0, 1],
      duration: 650,
      ease: 'inOutQuart',
      onComplete: () => {
        animate(this.el('.seam'), { opacity: 0, duration: 250 });
        animate(this.el('.curtain .top'), { translateY: '-100%', duration: 650, ease: 'inOutQuart' });
        animate(this.el('.curtain .bot'), {
          translateY: '100%',
          duration: 650,
          ease: 'inOutQuart',
          onComplete: () => curtain.remove(),
        });
        animate(this.el('[data-in]'), {
          translateY: [16, 0],
          opacity: [0, 1],
          delay: stagger(80, { start: 500 }),
          duration: 700,
          ease: 'outExpo',
        });
        animate(this.el('.login-card'), { translateY: [24, 0], opacity: [0, 1], duration: 800, delay: 250, ease: 'outExpo' });
      },
    });
  }
  ingresar() {
    if (this.busy()) return;
    this.error.set('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim())) {
      this.error.set('Ingresá un email válido.');
      shake(this.el('.login-card')[0]);
      return;
    }
    if (this.password.length < 8) {
      this.error.set('La contraseña debe tener al menos 8 caracteres.');
      shake(this.el('.login-card')[0]);
      return;
    }
    this.busy.set(true);
    this.data.login(this.email.trim().toLowerCase(), this.password).subscribe({
      next: (u) => {
        this.workspace.setUser(u);
        this.password = '';
        this.granted.set(true);
        const go = () => {
          this.busy.set(false);
          const target = this.route.snapshot.queryParamMap.get('returnUrl');
          this.router.navigateByUrl(target?.startsWith('/') && !target.startsWith('//') && !target.startsWith('/login') ? target : '/dashboard');
        };
        if (reducedMotion()) return go();
        animate(this.el('.login-wrap'), { opacity: [1, 0], scale: [1, 0.98], duration: 380, delay: 250, ease: 'inQuad', onComplete: go });
      },
      error: (e) => {
        this.busy.set(false);
        shake(this.el('.login-card')[0]);
        this.error.set(
          e.status === 429
            ? 'Demasiados intentos. Esperá un minuto.'
            : e.status === 503
              ? e.error?.mensaje || 'La base de datos no está disponible. Revisá la conexión de la API con MySQL.'
              : e.status === 0
                ? 'No hay conexión con la API. Verificá que Gamexid.Api esté en ejecución.'
                : e.error?.mensaje || 'No se pudo iniciar sesión.',
        );
      },
    });
  }
}
