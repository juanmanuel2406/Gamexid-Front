import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { FastScanService, Branch, Product } from '../../services-fastscan/fastscan-service';
import { OrdersService, BranchOrder, OrderLine } from '../../services-fastscan/orders';
@Component({ selector: 'app-sucursales', templateUrl: './sucursales.html', styleUrl: './sucursales.css', standalone: false })
export class Sucursales implements OnInit {
  sucursales: Branch[] = []; productos: Product[] = []; pedidos: BranchOrder[] = [];
  draft: BranchOrder | null = null; mensaje = ''; busy = false;
  constructor(private service: FastScanService, private orders: OrdersService, private cdr: ChangeDetectorRef) {}
  async ngOnInit() {
    const depot = this.service.getDeposito();
    this.service.getSucursales().subscribe(items => this.sucursales = items.filter(b => b.isActive && b.id !== depot.id));
    this.service.getProductos().subscribe(items => this.productos = items);
    try { this.pedidos = await this.orders.list(); } catch (error) { this.error(error); }
    this.cdr.detectChanges();
  }
  nuevo() {
    this.mensaje = '';
    this.draft = { id: crypto.randomUUID(), reference: '', branchId: 0, created: new Date().toISOString(), fileName: '', lines: [] };
  }
  editar(order: BranchOrder) { this.mensaje = ''; this.draft = structuredClone(order); }
  @HostListener('document:keydown.escape')
  cerrar() { if (!this.busy) this.draft = null; }
  agregar() { this.draft?.lines.push({ ean: '', name: '', expected: null, received: 0 }); }
  relacionar(line: OrderLine) {
    const product = this.productos.find(p => p.ean === line.ean.trim());
    if (product) line.name = product.name;
  }
  marcar(line: OrderLine, event: Event) { line.received = (event.target as HTMLInputElement).checked ? line.expected || 0 : 0; }
  nombre(id: number) { return this.sucursales.find(b => b.id === id)?.name || 'Sucursal archivada'; }
  faltantes(order: BranchOrder) { return order.lines.reduce((n, l) => n + Math.max(0, (l.expected || 0) - l.received), 0); }
  error(error: unknown) { this.mensaje = error instanceof Error ? error.message : 'No se pudo completar la operación.'; }
  async guardar() {
    if (!this.draft || this.busy) return;
    this.busy = true;
    try {
      if (!this.sucursales.some(b => b.id === this.draft!.branchId)) throw new Error('Seleccioná una sucursal activa.');
      await this.orders.save(this.draft);
      this.pedidos = await this.orders.list();
      this.draft = null; this.mensaje = 'Pedido guardado. Podés volver a abrirlo para controlar la recepción.';
    } catch (error) { this.error(error); }
    finally { this.busy = false; this.cdr.detectChanges(); }
  }
  async importar(event: Event) {
    const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = '';
    if (!file || !this.draft || this.busy) return;
    this.busy = true; this.mensaje = '';
    let task: { destroy(): Promise<void> } | undefined;
    try {
      if (!file.name.toLowerCase().endsWith('.pdf') || file.size > 10 * 1024 * 1024) throw new Error('Seleccioná un PDF de hasta 10 MB.');
      const data = new Uint8Array(await file.arrayBuffer());
      if (new TextDecoder().decode(data.slice(0, 5)) !== '%PDF-') throw new Error('El archivo no es un PDF válido.');
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
      const loading = pdfjs.getDocument({ data }); task = loading;
      loading.onPassword = () => { void loading.destroy(); };
      const pdf = await loading.promise;
      if (pdf.numPages > 50) throw new Error('El pedido admite hasta 50 páginas.');
      const candidates = new Set<string>();
      for (let page = 1; page <= pdf.numPages; page++) {
        const content = await (await pdf.getPage(page)).getTextContent();
        const text = content.items.map(item => 'str' in item ? item.str : '').join(' ');
        for (const match of text.matchAll(/(?<!\d)(?:\d{14}|\d{13}|\d{12}|\d{8})(?!\d)/g)) candidates.add(match[0]);
      }
      this.draft.pdf = file; this.draft.fileName = file.name;
      for (const ean of candidates) {
        if (!this.draft.lines.some(l => l.ean === ean)) this.draft.lines.push({ ean, name: this.productos.find(p => p.ean === ean)?.name || '', expected: null, received: 0 });
      }
      this.mensaje = candidates.size ? 'Revisá los códigos encontrados y completá las cantidades según el PDF antes de guardar.' : 'PDF adjunto sin EAN legibles. Si es una imagen, cargá las líneas manualmente. La lectura con Gemini aún no está conectada.';
    } catch (error) { this.error(error); }
    finally { await task?.destroy().catch(() => {}); this.busy = false; this.cdr.detectChanges(); }
  }
  descargar() {
    if (!this.draft?.pdf) return;
    const url = URL.createObjectURL(this.draft.pdf); const link = document.createElement('a');
    link.href = url; link.download = this.draft.fileName; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
