import { Component, input, output, inject, signal, computed, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, timeout } from 'rxjs';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { Product } from '../../services-gamexid/gamexid-service';
import { Workspace } from '../../core/workspace';
import { Icon } from '../../shared/icon';
import { Motion } from '../../shared/motion';
export interface ExtractionLine {
  ean: string;
  name: string;
  expected: number | null;
  confidence: number | null;
  sku?: string | null;
  unitPrice?: number | null;
  total?: number | null;
  currency?: string | null;
  page?: number;
  rawText?: string;
  warnings?: string[];
}
export interface Extraction {
  file: File;
  lines: ExtractionLine[];
  source: 'preview' | 'pdfpig';
}
@Component({
  selector: 'gx-intake',
  standalone: true,
  imports: [FormsModule, TagModule, SkeletonModule, Icon],
  templateUrl: './intake.html',
  styleUrl: './intake.css',
})
export class Intake implements OnDestroy {
  products = input<Product[]>([]);
  parsed = output<Extraction>();
  readonly workspace = inject(Workspace);
  private http = inject(HttpClient);
  private motion = inject(Motion);
  readonly file = signal<File | null>(null);
  readonly busy = signal(false);
  readonly dragging = signal(false);
  readonly preview = signal('');
  readonly lines = signal<ExtractionLine[]>([]);
  readonly message = signal('');
  readonly source = signal<'preview' | 'pdfpig'>('preview');
  readonly pageCount = signal(0);
  readonly page = signal(1);
  readonly tokens = computed(() =>
    JSON.stringify(
      {
        source: this.source() === 'pdfpig' ? 'PdfPig · revisión manual' : 'Vista previa',
        products: this.lines(),
      },
      null,
      2,
    )
      .split(/("(?:[^"\\]|\\.)*"\s*:|"(?:[^"\\]|\\.)*"|\b\d+(?:\.\d+)?\b|\bnull\b)/g)
      .filter(Boolean)
      .map((value) => ({
        value,
        kind: value.endsWith(':')
          ? 'json-key'
          : value.startsWith('"')
            ? 'json-value'
            : /^\d/.test(value)
              ? 'json-number'
              : '',
      })),
  );
  private task: any;
  private document: any;
  private laser?: ReturnType<Motion['laser']>;
  private destroyed = false;
  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(false);
    const files = event.dataTransfer?.files;
    if (files?.length === 1) void this.load(files[0]);
    else this.message.set('Cargá un solo PDF por pedido.');
  }
  onInput(event: Event) {
    const el = event.target as HTMLInputElement;
    const file = el.files?.[0];
    el.value = '';
    if (file) void this.load(file);
  }
  async load(file: File) {
    if (this.busy()) return;
    this.message.set('');
    this.preview.set('');
    this.lines.set([]);
    this.file.set(null);
    this.busy.set(true);
    try {
      if (!file.name.toLowerCase().endsWith('.pdf') || file.size > 10 * 1024 * 1024)
        throw new Error('Seleccioná un PDF de hasta 10 MB.');
      const data = new Uint8Array(await file.arrayBuffer());
      if (new TextDecoder().decode(data.slice(0, 5)) !== '%PDF-')
        throw new Error('El archivo no es un PDF válido.');
      await this.task?.destroy();
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
      this.task = pdfjs.getDocument({ data });
      let rejectPassword: (reason: Error) => void = () => {};
      const passwordError = new Promise<never>((_, reject) => (rejectPassword = reject));
      this.task.onPassword = () => {
        rejectPassword(new Error('El PDF tiene contraseña. Cargá una copia sin protección.'));
      };
      this.document = await Promise.race([this.task.promise, passwordError]);
      if (this.document.numPages > 50) throw new Error('El pedido admite hasta 50 páginas.');
      this.file.set(file);
      this.pageCount.set(this.document.numPages);
      this.page.set(1);
      await this.render(1);
      if (this.destroyed) return;
      this.source.set('preview');
      this.parsed.emit({ file, lines: [], source: 'preview' });
      this.message.set('PDF adjunto. Pulsá «Extraer con PdfPig» para leer productos, cantidades y precios.');
    } catch (e) {
      this.message.set(e instanceof Error ? e.message : 'No se pudo leer el PDF.');
      await this.task?.destroy().catch(() => {});
      this.document = null;
      this.file.set(null);
    } finally {
      this.busy.set(false);
    }
  }
  async render(n: number) {
    if (!this.document) return;
    try {
      const page = await this.document.getPage(n);
      const viewport = page.getViewport({ scale: 1.1 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise;
      if (!this.destroyed) {
        this.preview.set(canvas.toDataURL('image/webp'));
        this.page.set(n);
      }
    } catch {
      this.message.set('No se pudo mostrar esta página. Probá otra página o descargá el PDF.');
    }
  }
  async extract(laser: HTMLElement) {
    const file = this.file();
    if (!file || !this.workspace.pdfPig() || this.busy()) return;
    this.busy.set(true);
    this.message.set('');
    this.laser = this.motion.laser(laser);
    try {
      const form = new FormData();
      form.append('file', file);
      const result = await firstValueFrom(
        this.http
          .post<{ lines: ExtractionLine[]; warnings: string[]; requiresOcr: boolean }>('/api/documents/extract', form, {
            headers: { 'X-Gamexid': '1' },
          })
          .pipe(timeout(65000)),
      );
      if (this.destroyed) return;
      this.lines.set(result.lines);
      this.source.set('pdfpig');
      this.parsed.emit({ file, lines: result.lines, source: 'pdfpig' });
      this.message.set(result.warnings.join(' '));
    } catch (e: any) {
      this.message.set(
        e.error?.mensaje || 'No se pudo extraer el PDF. Podés completar el pedido manualmente.',
      );
    } finally {
      this.busy.set(false);
      this.laser?.revert();
    }
  }
  ngOnDestroy() {
    this.destroyed = true;
    void this.task?.destroy();
    this.laser?.revert();
  }
}
