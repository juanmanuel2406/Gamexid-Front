import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
export interface OrderLine {
  id?: number;
  productId?: number;
  ean: string;
  sku?: string | null;
  unitPrice?: number | null;
  total?: number | null;
  currency?: string | null;
  name: string;
  expected: number | null;
  received: number;
  serials?: { id: number; serial: string; status: string; scannedDate: string }[];
}
export interface BranchOrder {
  id: string;
  reference: string;
  branchId: number;
  created: string;
  fileName: string;
  status?: string;
  pdf?: Blob;
  referenceSource?: 'pdf' | 'missing' | 'manual';
  lines: OrderLine[];
}
export interface CreateOrderDto {
  id: string;
  reference: string;
  branchId: number;
  created: string;
  fileName: string;
  lines: {
    ean: string;
    sku: string | null;
    name: string;
    expected: number;
    unitPrice: number | null;
    total: number | null;
    currency: string | null;
  }[];
}
export interface OrderResponseDto extends Omit<BranchOrder, 'pdf' | 'status' | 'lines'> {
  status: 'Pending' | 'Partial' | 'Received';
  lines: (OrderLine & {
    id: number;
    productId: number;
    expected: number;
    serials: NonNullable<OrderLine['serials']>;
  })[];
}
export interface SaveSerialDto {
  orderItemId: number;
  serial: string;
}
export interface OrderPageDto {
  items: OrderResponseDto[];
  total: number;
  page: number;
  pageSize: number;
}
@Injectable({ providedIn: 'root' })
export class OrdersService {
  private http = inject(HttpClient);
  list(branchId: number, page = 1, search = '', status = ''): Promise<OrderPageDto> {
    let params = new HttpParams().set('branchId', branchId).set('page', page).set('pageSize', 20);
    if (search.trim()) params = params.set('search', search.trim());
    if (status) params = params.set('status', status);
    return firstValueFrom(
      this.http.get<OrderPageDto>('/api/orders', { params }).pipe(timeout(30000)),
    );
  }
  save(order: BranchOrder): Promise<OrderResponseDto> {
    this.validarPedido(order);
    const dto: CreateOrderDto = {
      id: order.id,
      reference: order.reference,
      branchId: order.branchId,
      created: order.created,
      fileName: order.fileName,
      lines: order.lines.map((linea) => this.prepararLinea(linea)),
    };
    return firstValueFrom(
      this.http.post<OrderResponseDto>('/api/orders', dto).pipe(timeout(30000)),
    );
  }
  saveSerial(id: string, dto: SaveSerialDto): Promise<OrderResponseDto> {
    return firstValueFrom(
      this.http.post<OrderResponseDto>('/api/orders/' + id + '/serials', dto).pipe(timeout(30000)),
    );
  }
  private validarPedido(pedido: BranchOrder): void {
    const faltanDatos = !pedido.reference.trim() || !pedido.branchId || !pedido.lines.length;
    if (faltanDatos || pedido.lines.some((linea) => !this.lineaValida(linea))) {
      throw new Error('Revisá referencia, sucursal, EAN, cantidades y moneda.');
    }
  }

  private lineaValida(linea: OrderLine): boolean {
    if (!/^(?:\d{8}|\d{12,14})$/.test(linea.ean) || !linea.name.trim()) {
      return false;
    }
    if (linea.expected === null || !Number.isSafeInteger(linea.expected) || linea.expected < 1) {
      return false;
    }
    const tieneImporte = linea.unitPrice != null || linea.total != null;
    const monedaValida = linea.currency === 'ARS' || linea.currency === 'USD';
    if (tieneImporte && !monedaValida) {
      return false;
    }
    return true;
  }

  private prepararLinea(linea: OrderLine): CreateOrderDto['lines'][number] {
    return {
      ean: linea.ean,
      sku: linea.sku || null,
      name: linea.name,
      expected: linea.expected!,
      unitPrice: linea.unitPrice ?? null,
      total: linea.total ?? null,
      currency: linea.currency || null,
    };
  }

  message(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.error?.mensaje) {
        return error.error.mensaje;
      }
      if (error.status === 401) {
        return 'La sesión venció. Volvé a ingresar.';
      }
      return 'No se pudo confirmar la operación. Conservá los datos y reintentá; no se duplicará la recepción.';
    }
    if (error instanceof Error && error.name !== 'TimeoutError') {
      return error.message;
    }
    return 'Conexión interrumpida. Reintentá con los mismos datos para confirmar el resultado.';
  }
}
