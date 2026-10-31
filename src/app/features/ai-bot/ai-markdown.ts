import { Component, computed, input } from '@angular/core';

interface Fragmento {
  tipo: 'texto' | 'negrita' | 'codigo' | 'imagen';
  texto: string;
  url?: string;
}

@Component({
  selector: 'app-ai-markdown',
  standalone: true,
  template: `@for (parte of partes(); track $index) {
    @switch (parte.tipo) {
      @case ('negrita') { <strong>{{ parte.texto }}</strong> }
      @case ('codigo') { <code>{{ parte.texto }}</code> }
      @case ('imagen') {
        <img [src]="parte.url" [alt]="parte.texto" loading="lazy" referrerpolicy="no-referrer"
          (error)="ocultarImagen($event)" />
      }
      @default { <span>{{ parte.texto }}</span> }
    }
  }`,
  styles: `:host { display: block; white-space: pre-wrap; overflow-wrap: anywhere; }
    img { display:block; width:100%; max-height:210px; object-fit:contain; background:#fff; border-radius:8px; margin:10px 0; }
    code { font-family:monospace; background:var(--k-bg); padding:2px 4px; border-radius:3px; }`,
})
export class AiMarkdown {
  readonly texto = input('');
  readonly imagenes = input<string[]>([]);
  readonly partes = computed(() => {
    const texto = this.texto();
    const resultado: Fragmento[] = [];
    const patron = /!\[([^\]\n]*)\]\(([^\s)]+)\)|\*\*([^*]+)\*\*|`([^`\n]+)`/g;
    let inicio = 0;
    for (const coincidencia of texto.matchAll(patron)) {
      const posicion = coincidencia.index!;
      if (posicion > inicio) resultado.push({ tipo: 'texto', texto: texto.slice(inicio, posicion) });
      if (coincidencia[2]) {
        if (this.imagenes().includes(coincidencia[2]) && this.imagenSegura(coincidencia[2])) {
          resultado.push({ tipo: 'imagen', texto: coincidencia[1] || 'Producto', url: coincidencia[2] });
        } else {
          resultado.push({ tipo: 'texto', texto: coincidencia[1] || 'Imagen no disponible' });
        }
      } else if (coincidencia[3]) {
        resultado.push({ tipo: 'negrita', texto: coincidencia[3] });
      } else {
        resultado.push({ tipo: 'codigo', texto: coincidencia[4] });
      }
      inicio = posicion + coincidencia[0].length;
    }
    if (inicio < texto.length) resultado.push({ tipo: 'texto', texto: texto.slice(inicio) });
    return resultado;
  });

  private imagenSegura(url: string): boolean {
    try {
      const imagen = new URL(url);
      return imagen.protocol === 'https:' && ['www.gamingcity.com.ar', 'gamingcity.com.ar'].includes(imagen.hostname)
        && !imagen.port && !imagen.username && !imagen.password && !imagen.search && !imagen.hash
        && /^\/images\/[a-zA-Z0-9_./-]+\.(jpg|jpeg|png|webp)$/i.test(imagen.pathname);
    } catch { return false; }
  }

  ocultarImagen(evento: Event): void {
    const imagen = evento.target as HTMLImageElement;
    imagen.hidden = true;
    imagen.style.display = 'none';
  }
}
