import { Component, DestroyRef, ElementRef, effect, inject, input, signal, viewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Subscription, timeout } from 'rxjs';
import { Workspace } from '../../core/workspace';
import { AiMarkdown } from './ai-markdown';
import { Icon } from '../../shared/icon';
import { GxIsotype } from '../../shared/gx-isotype';

interface ProductoChat {
  id: string;
  name: string;
  code: string;
  description: string;
  imageUrl: string | null;
  webUrl: string | null;
}
interface RespuestaChat {
  respuesta: string;
  productos: ProductoChat[];
  fuentes: string[];
  consultadoUtc: string;
}
interface MensajeChat {
  rol: 'usuario' | 'asistente';
  texto: string;
  productos: ProductoChat[];
  imagenes: string[];
  fuentes: string[];
  fecha?: string;
}

@Component({
  selector: 'app-ai-bot',
  standalone: true,
  imports: [FormsModule, DatePipe, Icon, AiMarkdown, GxIsotype],
  templateUrl: './ai-bot.html',
  styleUrl: './ai-bot.css',
})
export class AiBot {
  readonly contexto = input.required<'Productos' | 'Pedidos'>();
  readonly workspace = inject(Workspace);
  private http = inject(HttpClient);
  private destroy = inject(DestroyRef);
  private consulta?: Subscription;
  private estado?: Subscription;
  private version = 0;
  private entrada = viewChild<ElementRef<HTMLTextAreaElement>>('entrada');
  private historial = viewChild<ElementRef<HTMLElement>>('historial');
  private boton = viewChild<ElementRef<HTMLButtonElement>>('boton');
  readonly abierto = signal(false);
  readonly disponible = signal(false);
  readonly comprobando = signal(true);
  readonly enviando = signal(false);
  readonly error = signal('');
  readonly mensajes = signal<MensajeChat[]>([]);
  readonly demora = signal(false);
  private aviso?: ReturnType<typeof setTimeout>;
  texto = '';

  constructor() {
    effect(() => {
      this.contexto();
      this.workspace.branchId();
      this.workspace.user()?.id;
      this.limpiar();
      this.comprobar();
    });
    this.destroy.onDestroy(() => { this.consulta?.unsubscribe(); this.estado?.unsubscribe(); clearTimeout(this.aviso); });
    effect(() => {
      clearTimeout(this.aviso);
      this.demora.set(false);
      if (this.enviando()) this.aviso = setTimeout(() => this.demora.set(true), 8000);
    });
  }

  comprobar(): void {
    this.estado?.unsubscribe();
    this.comprobando.set(true);
    this.disponible.set(false);
    this.estado = this.http.get<{ configured: boolean }>('/api/chat/status').pipe(timeout(8000)).subscribe({
      next: estado => {
        this.disponible.set(estado.configured);
        this.comprobando.set(false);
        this.error.set(estado.configured ? '' : 'El asistente todavía no está activado.');
      },
      error: () => {
        this.comprobando.set(false);
        this.error.set('No se pudo consultar el estado del asistente.');
      },
    });
  }

  alternar(): void {
    this.abierto.update(valor => !valor);
    if (this.abierto()) setTimeout(() => this.entrada()?.nativeElement.focus());
  }

  cerrar(): void {
    this.abierto.set(false);
    this.boton()?.nativeElement.focus();
  }

  limpiar(): void {
    this.version++;
    this.consulta?.unsubscribe();
    this.enviando.set(false);
    this.mensajes.set([]);
    this.error.set('');
    this.texto = '';
  }

  sugerir(texto: string): void {
    this.texto = texto;
    this.entrada()?.nativeElement.focus();
  }

  enviar(): void {
    const mensaje = this.texto.trim();
    if (!mensaje || mensaje.length > 1500 || this.enviando() || !this.disponible() || !this.workspace.branchId()) return;
    const anteriores = this.mensajes();
    const preguntas = anteriores.filter(m => m.rol === 'usuario').slice(-6).map(m => m.texto);
    const productosAnteriores = [...anteriores].reverse().find(m => m.rol === 'asistente')?.productos.map(p => p.id) ?? [];
    this.mensajes.set([...anteriores, { rol: 'usuario', texto: mensaje, productos: [], imagenes: [], fuentes: [] }]);
    this.texto = '';
    this.enviando.set(true);
    this.error.set('');
    this.bajar();
    const version = ++this.version;
    this.consulta = this.http.post<RespuestaChat>('/api/chat/ask', {
      mensaje, contextoPantalla: this.contexto(), sucursalId: this.workspace.branchId(), preguntasAnteriores: preguntas,
      productosAnteriores,
    }).pipe(timeout(70000)).subscribe({
      next: respuesta => {
        if (version !== this.version) return;
        const productos = (respuesta.productos || []).slice(0, 4);
        this.mensajes.update(actuales => [...actuales, {
          rol: 'asistente', texto: respuesta.respuesta, productos,
          imagenes: productos.map(p => p.imageUrl).filter((url): url is string => !!url),
          fuentes: respuesta.fuentes || [], fecha: respuesta.consultadoUtc,
        }]);
        this.enviando.set(false);
        this.bajar();
      },
      error: error => {
        if (version !== this.version) return;
        this.mensajes.set(anteriores);
        this.texto = mensaje;
        this.enviando.set(false);
        this.error.set(error.status === 429 ? 'Muchas consultas seguidas. Esperá un momento y reintentá.' :
          error.error?.mensaje || 'No pude completar la consulta. Podés reintentar.');
      },
    });
  }

  foto(producto: ProductoChat): string {
    return producto.imageUrl ? `![${producto.name.replace(/[\[\]\r\n]/g, '')}](${producto.imageUrl})` : 'Foto no disponible';
  }

  enlaceSeguro(producto: ProductoChat): string | null {
    if (!producto.webUrl) return null;
    try {
      const url = new URL(producto.webUrl);
      return url.protocol === 'https:' && ['www.gamingcity.com.ar', 'gamingcity.com.ar'].includes(url.hostname)
        && !url.port && !url.username && !url.password && !url.search && !url.hash
        && url.pathname.endsWith('--det--' + producto.id) ? url.href : null;
    } catch { return null; }
  }

  private bajar(): void {
    setTimeout(() => {
      const historial = this.historial()?.nativeElement;
      if (historial) historial.scrollTop = historial.scrollHeight;
    });
  }
}
