import { Injectable } from '@angular/core';
export interface OrderLine { ean: string; name: string; expected: number | null; received: number; }
export interface BranchOrder { id: string; reference: string; branchId: number; created: string; fileName: string; pdf?: Blob; lines: OrderLine[]; }
@Injectable({ providedIn: 'root' })
export class OrdersService {
  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('gamexid-orders', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('orders', { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('No se pudo abrir el almacenamiento de pedidos.'));
    });
  }
  async list(): Promise<BranchOrder[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('orders', 'readonly');
      const request = transaction.objectStore('orders').getAll();
      transaction.oncomplete = () => { db.close(); resolve(request.result.sort((a: BranchOrder, b: BranchOrder) => b.created.localeCompare(a.created))); };
      transaction.onerror = () => { db.close(); reject(new Error('No se pudieron leer los pedidos.')); };
    });
  }
  async save(order: BranchOrder): Promise<void> {
    if (!order.reference.trim() || !order.branchId || !order.lines.length ||
        order.lines.some(l => !/^(?:\d{8}|\d{12,14})$/.test(l.ean) || !l.name.trim() ||
          !Number.isSafeInteger(l.expected) || l.expected! < 1 ||
          !Number.isSafeInteger(l.received) || l.received < 0 || l.received > l.expected!))
      throw new Error('Revisá referencia, sucursal, EAN y cantidades. Recibido no puede superar lo pedido.');
    if (new Set(order.lines.map(l => l.ean)).size !== order.lines.length)
      throw new Error('Unificá las líneas con EAN repetidos antes de guardar.');
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('orders', 'readwrite');
      transaction.objectStore('orders').put(order);
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onabort = transaction.onerror = () => { db.close(); reject(new Error('No se pudo guardar. Verificá el espacio disponible del navegador.')); };
    });
  }
}
