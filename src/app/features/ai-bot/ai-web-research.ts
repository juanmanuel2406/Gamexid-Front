import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { AiMarkdown } from './ai-markdown';

export interface InvestigacionWeb {
  productoId: string;
  nombre: string;
  texto: string;
  fuentes: { numero: number; titulo: string; url: string }[];
  sugerenciasHtml: string;
}

@Component({
  selector: 'app-ai-web-research',
  standalone: true,
  imports: [AiMarkdown],
  template: `
    <section aria-label="Información ampliada en la web">
      <span class="etiqueta">Información web · Google Search</span>
      <h3>{{ investigacion().nombre }}</h3>
      <app-ai-markdown [texto]="investigacion().texto" />
      <ol aria-label="Fuentes de la investigación">
        @for (fuente of investigacion().fuentes; track fuente.numero) {
          @if (enlaceSeguro(fuente.url); as url) {
            <li [value]="fuente.numero"><a [href]="url" target="_blank" rel="noopener noreferrer">{{ fuente.titulo }}</a></li>
          }
        }
      </ol>
      @if (sugerencias(); as contenido) {
        <iframe title="Sugerencias de Google Search" sandbox="allow-popups allow-popups-to-escape-sandbox"
          referrerpolicy="no-referrer" [srcdoc]="contenido"></iframe>
      }
      <small>Información complementaria. La disponibilidad se consulta en el catálogo.</small>
    </section>
  `,
  styles: `
    :host { display: block; margin-top: 14px; min-width: 0; }
    section { border: 1px solid #435476; border-radius: 12px; padding: 14px; background: #141a25; color: #edf1fa; overflow-wrap: anywhere; }
    .etiqueta { color: #b8c9ff; font-size: 11px; font-weight: 600; }
    h3 { font-size: 14px; line-height: 1.4; margin: 8px 0 12px; }
    ol { padding-left: 22px; font-size: 12px; }
    li { margin: 6px 0; }
    a { color: #b7d5ff; text-decoration: underline; }
    a:focus-visible { outline: 2px solid #b7d5ff; outline-offset: 3px; }
    iframe { display: block; width: 100%; height: 150px; border: 0; background: white; border-radius: 8px; }
    small { display: block; color: #c0c9db; font-size: 11px; margin-top: 12px; }
  `,
})
export class AiWebResearch {
  readonly investigacion = input.required<InvestigacionWeb>();
  private sanitizer = inject(DomSanitizer);
  readonly sugerencias = computed(() => {
    const html = this.investigacion().sugerenciasHtml;
    if (!html || html.length > 50000) return null;
    const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; form-action 'none'; base-uri 'none'">`;
    return this.sanitizer.bypassSecurityTrustHtml(policy + html);
  });

  enlaceSeguro(value: string): string | null {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password && !url.port
        && url.hostname.includes('.') && !/^[\d.]+$/.test(url.hostname)
        && !/\.(local|internal)$/i.test(url.hostname) ? url.href : null;
    } catch { return null; }
  }
}
