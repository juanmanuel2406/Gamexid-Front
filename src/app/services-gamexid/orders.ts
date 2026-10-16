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
  supplier: string;
  reference: string;
  branchId: number;
  created: string;
  fileName: string;
  status?: string;
  pdf?: Blob;
  lines: OrderLine[];
}
export interface CreateOrderDto {
  id: string;
  supplier: string;
  reference: string;
  branchId: number;
  created: string;
  fileName: string;
  lines: { ean: string; sku: string | null; name: string; expected: number;
    unitPrice: number | null; total: number | null; currency: string | null }[];
}
export interface OrderResponseDto extends Omit<BranchOrder, 'pdf' | 'status' | 'lines'> {
  status: 'Pending' | 'Partial' | 'Received';
  lines: (OrderLine & { id: number; productId: number; expected: number; serials: NonNullable<OrderLine['serials']> })[];
}
export interface SaveSerialDto { orderItemId: number; serial: string }
export interface OrderPageDto { items: OrderResponseDto[]; total: number; page: number; pageSize: number }
@Injectable({ providedIn: 'root' })
export class OrdersService {
  private http = inject(HttpClient);
  list(branchId: number, page = 1, search = '', status = ''): Promise<OrderPageDto> {
    let params = new HttpParams().set('branchId', branchId).set('page', page).set('pageSize', 20);
    if (search.trim()) params = params.set('search', search.trim());
    if (status) params = params.set('status', status);
    return firstValueFrom(this.http.get<OrderPageDto>('/api/orders', { params }).pipe(timeout(30000)));
  }
  save(order: BranchOrder): Promise<OrderResponseDto> {
    if (!order.supplier.trim() || !order.reference.trim() || !order.branchId || !order.lines.length ||
        order.lines.some(l => !/^(?:\d{8}|\d{12,14})$/.test(l.ean) || !l.name.trim() ||
          !Number.isSafeInteger(l.expected) || l.expected! < 1))
      throw new Error('Revisá proveedor, referencia, sucursal, EAN y cantidades.');
    const dto: CreateOrderDto = {
      id: order.id, supplier: order.supplier, reference: order.reference, branchId: order.branchId,
      created: order.created, fileName: order.fileName,
      lines: order.lines.map(l => ({ ean: l.ean, sku: l.sku || null, name: l.name, expected: l.expected!,
        unitPrice: l.unitPrice ?? null, total: l.total ?? null, currency: l.currency || null })),
    };
    return firstValueFrom(this.http.post<OrderResponseDto>('/api/orders', dto).pipe(timeout(30000)));
  }
  saveSerial(id: string, dto: SaveSerialDto): Promise<OrderResponseDto> {
    return firstValueFrom(this.http.post<OrderResponseDto>('/api/orders/' + id + '/serials', dto).pipe(timeout(30000)));
  }
  message(error: unknown): string {
    if (error instanceof HttpErrorResponse)
      return error.error?.mensaje || (error.status === 401 ? 'La sesión venció. Volvé a ingresar.' :
        'No se pudo confirmar la operación. Conservá los datos y reintentá; no se duplicará la recepción.');
    return error instanceof Error && error.name !== 'TimeoutError' ? error.message :
      'Conexión interrumpida. Reintentá con los mismos datos para confirmar el resultado.';
  }
}
