import { Injectable } from '@angular/core';
import { Observable, tap, timeout } from 'rxjs';
import { HttpClient } from '@angular/common/http';

export type UserRole = 'Administrator' | 'Manager' | 'Operator';

export interface Branch {
  id: number;
  code: string;
  name: string;
  address?: string;
  isLegacy?: boolean;
  isActive: boolean;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  ean: string;
  requiresSerialNumber: boolean;
  isActive: boolean;
}

export type UnitStatus = 'Available' | 'Sold' | 'Transferred' | 'Returned';

export interface SerializedUnit {
  id: number;
  productId: number;
  serialNumber: string;
  currentBranchId?: number;
  status: UnitStatus;
}

export type MovementType = 'Ingreso' | 'Transferencia' | 'Venta' | 'Devolución' | 'Ajuste';

export interface InventoryMovement {
  id: number;
  type: MovementType;
  sourceBranchId?: number;
  destinationBranchId?: number;
  registeredByUserId?: number;
  createdAtUtc: string;
  notes?: string;
  items: InventoryMovementItem[];
}

export interface InventoryMovementItem {
  id: number;
  productId: number;
  serializedUnitId?: number;
  quantity: number;
}

export interface User {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
  branchId?: number;
  isActive: boolean;
}

export function rolLabel(role: string): string {
  const r = (role || '').toLowerCase();
  if (r.startsWith('admin')) return 'Administrador';
  if (r.startsWith('manage')) return 'Gerente';
  return 'Operador';
}

export interface ProductLookup {
  product: Product;
  matchedBy: 'ean' | 'sku' | 'serial';
  unit: SerializedUnit | null;
  alreadyInInventory: boolean;
}

@Injectable({ providedIn: 'root' })
export class GamexidService {
  private branches: Branch[] = [];
  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<User> {
    return this.http.post<User>('/api/access/login', { email, password });
  }
  session(): Observable<User> { return this.http.get<User>('/api/access/me'); }
  logout(): Observable<void> { return this.http.post<void>('/api/access/logout', {}); }

  getProductos(): Observable<Product[]> {
    return this.http.get<Product[]>('/api/products').pipe(timeout(15000));
  }
  buscarProductoPorEan(ean: string): Observable<Product | null> {
    return this.http.get<Product>('/api/products/ean/' + encodeURIComponent(ean.trim()));
  }
  buscarProductoPorCodigo(code: string): Observable<ProductLookup> {
    return this.http.get<ProductLookup>('/api/products/lookup', { params: { code: code.trim() } }).pipe(timeout(15000));
  }
  crearProducto(dto: { sku: string; name: string; ean: string; requiresSerialNumber: boolean }): Observable<Product> {
    return this.http.post<Product>('/api/products', { ...dto, sku: dto.sku.trim(), name: dto.name.trim(), ean: dto.ean.trim() });
  }
  getDeposito(): Branch {
    return this.branches.find(b => b.code === 'DEP-CENTRAL') ??
      { id: 0, code: 'DEP-CENTRAL', name: 'Depósito pendiente de conexión', isActive: false };
  }
  getSucursales(): Observable<Branch[]> {
    return this.http.get<Branch[]>('/api/branches').pipe(timeout(15000), tap(branches => this.branches = branches));
  }
  crearSucursal(dto: { code: string; name: string; address?: string }): Observable<Branch> {
    return this.http.post<Branch>('/api/branches', dto);
  }
  getUnidadesDeProducto(productId: number): Observable<SerializedUnit[]> {
    return this.http.get<SerializedUnit[]>('/api/products/' + productId + '/units');
  }
  getMovimientos(): Observable<InventoryMovement[]> {
    return this.http.get<InventoryMovement[]>('/api/inventory/movements').pipe(timeout(15000));
  }
  registrarIngreso(dto: {
    destinationBranchId: number; notes?: string;
    items: { productId: number; quantity: number; serials: string[]; requiresSerialNumber: boolean }[];
  }): Observable<InventoryMovement> {
    return this.http.post<InventoryMovement>('/api/inventory/receipts', dto).pipe(timeout(30000));
  }
}
