import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

/* ================================================================
   INTERFACES / MODELOS (espejan el backend FastScan)
   ================================================================ */

export type UserRole = 'Administrator' | 'Manager' | 'Operator';

export interface Branch {
  id: number;
  code: string;
  name: string;
  address?: string;
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

/* ===== Helpers de presentación (toleran casing) ===== */
export function rolLabel(role: string): string {
  const r = (role || '').toLowerCase();
  if (r.startsWith('admin')) return 'Administrador';
  if (r.startsWith('manage')) return 'Gerente';
  return 'Operador';
}

/* ================================================================
   SERVICIO CENTRAL — mock en localStorage
   ================================================================ */

const K_BRANCHES = 'fs_branches';
const K_PRODUCTS = 'fs_products';
const K_UNITS = 'fs_units';
const K_MOVEMENTS = 'fs_movements';
const K_USERS = 'fs_users';

@Injectable({ providedIn: 'root' })
export class FastScanService {
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      this.seed();
    }
  }

  /* ---- Utilidades de storage ---- */
  private read<T>(key: string, fallback: T): T {
    if (!isPlatformBrowser(this.platformId)) return fallback;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  private write<T>(key: string, value: T): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }

  private nextId(list: { id: number }[]): number {
    return list.length ? Math.max(...list.map((x) => x.id)) + 1 : 1;
  }

  /* ---- Seed inicial (solo si no existe) ---- */
  private seed(): void {
    if (!localStorage.getItem(K_PRODUCTS)) {
      const productos: Product[] = [
        { id: 1, sku: 'NOTE-001', name: 'Notebook 14" 8GB', ean: '7790000000011', requiresSerialNumber: true, isActive: true },
        { id: 2, sku: 'MOUSE-01', name: 'Mouse inalámbrico', ean: '7790000000028', requiresSerialNumber: false, isActive: true },
        { id: 3, sku: 'TECLA-01', name: 'Teclado mecánico', ean: '7790000000035', requiresSerialNumber: false, isActive: true },
        { id: 4, sku: 'MON-24', name: 'Monitor 24" FullHD', ean: '7790000000042', requiresSerialNumber: true, isActive: true },
        { id: 5, sku: 'SSD-512', name: 'SSD 512GB NVMe', ean: '7790000000059', requiresSerialNumber: true, isActive: false },
      ];
      this.write(K_PRODUCTS, productos);
    }

    if (!localStorage.getItem(K_BRANCHES)) {
      const branches: Branch[] = [
        { id: 1, code: 'SUC01', name: 'Sucursal Centro', address: 'Av. Central 123', isActive: true },
        { id: 2, code: 'SUC02', name: 'Depósito Norte', address: 'Ruta 9 km 12', isActive: true },
        { id: 3, code: 'SUC03', name: 'Sucursal Sur', address: 'Calle 456', isActive: false },
      ];
      this.write(K_BRANCHES, branches);
    }

    if (!localStorage.getItem(K_UNITS)) {
      const units: SerializedUnit[] = [
        { id: 1, productId: 1, serialNumber: 'NB-10001', currentBranchId: 1, status: 'Available' },
        { id: 2, productId: 1, serialNumber: 'NB-10002', currentBranchId: 1, status: 'Available' },
        { id: 3, productId: 4, serialNumber: 'MON-90001', currentBranchId: 2, status: 'Available' },
      ];
      this.write(K_UNITS, units);
    }

    if (!localStorage.getItem(K_USERS)) {
      const users: User[] = [
        { id: 1, fullName: 'Juan Manuel', email: 'admin@fastscan.com', role: 'Administrator', isActive: true },
        { id: 2, fullName: 'María García', email: 'gerente@fastscan.com', role: 'Manager', branchId: 1, isActive: true },
        { id: 3, fullName: 'Lucas Pérez', email: 'operador@fastscan.com', role: 'Operator', branchId: 1, isActive: true },
      ];
      this.write(K_USERS, users);
    }

    if (!localStorage.getItem(K_MOVEMENTS)) {
      this.write(K_MOVEMENTS, [] as InventoryMovement[]);
    }
  }

  /* ===== LOGIN (demo sin token) ===== */
  login(email: string, password: string): Observable<User> {
    const users = this.read<User[]>(K_USERS, []);
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    // Demo: cualquier password de 4+ chars es válido
    if (user && user.isActive && password && password.length >= 4) {
      return of({ ...user });
    }
    return throwError(() => ({
      error: { mensaje: 'Credenciales inválidas o usuario inactivo.' },
    }));
  }

  /* ===== PRODUCTOS ===== */
  getProductos(): Observable<Product[]> {
    const list = this.read<Product[]>(K_PRODUCTS, []).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    return of(list);
  }

  buscarProductoPorEan(ean: string): Observable<Product | null> {
    const list = this.read<Product[]>(K_PRODUCTS, []);
    const found = list.find((p) => p.ean.trim() === ean.trim() && p.isActive);
    return of(found ?? null);
  }

  crearProducto(dto: { sku: string; name: string; ean: string; requiresSerialNumber: boolean }): Observable<Product> {
    const list = this.read<Product[]>(K_PRODUCTS, []);
    if (list.some((p) => p.sku.toLowerCase() === dto.sku.toLowerCase() || p.ean === dto.ean)) {
      return throwError(() => ({ error: { mensaje: 'El SKU o EAN ya está registrado.' } }));
    }
    const nuevo: Product = { id: this.nextId(list), ...dto, isActive: true };
    list.push(nuevo);
    this.write(K_PRODUCTS, list);
    return of(nuevo);
  }

  /* ===== SUCURSALES ===== */
  getSucursales(): Observable<Branch[]> {
    const list = this.read<Branch[]>(K_BRANCHES, []).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    return of(list);
  }

  crearSucursal(dto: { code: string; name: string; address?: string }): Observable<Branch> {
    const list = this.read<Branch[]>(K_BRANCHES, []);
    if (list.some((b) => b.code.toLowerCase() === dto.code.toLowerCase())) {
      return throwError(() => ({ error: { mensaje: 'Ya existe una sucursal con ese código.' } }));
    }
    const nueva: Branch = { id: this.nextId(list), ...dto, isActive: true };
    list.push(nueva);
    this.write(K_BRANCHES, list);
    return of(nueva);
  }

  /* ===== UNIDADES SERIALIZADAS ===== */
  getUnidadesDeProducto(productId: number): Observable<SerializedUnit[]> {
    const list = this.read<SerializedUnit[]>(K_UNITS, []);
    return of(list.filter((u) => u.productId === productId));
  }

  /* ===== INGRESOS (movimientos) ===== */
  getMovimientos(): Observable<InventoryMovement[]> {
    const list = this.read<InventoryMovement[]>(K_MOVEMENTS, []);
    return of([...list].sort((a, b) => b.id - a.id));
  }

  /**
   * Registra un ingreso de mercadería (tipo Ingreso) y actualiza
   * el stock de unidades serializadas cuando corresponda.
   */
  registrarIngreso(dto: {
    destinationBranchId: number;
    notes?: string;
    items: { productId: number; quantity: number; serials: string[]; requiresSerialNumber: boolean }[];
  }): Observable<InventoryMovement> {
    const movs = this.read<InventoryMovement[]>(K_MOVEMENTS, []);
    const mov: InventoryMovement = {
      id: this.nextId(movs),
      type: 'Ingreso',
      destinationBranchId: dto.destinationBranchId,
      registeredByUserId: 1,
      createdAtUtc: new Date().toISOString(),
      notes: dto.notes,
      items: [],
    };

    dto.items.forEach((item) => {
      if (item.requiresSerialNumber) {
        // Una unidad por serial
        item.serials.forEach((serial) => {
          mov.items.push({ id: this.nextId(mov.items), productId: item.productId, quantity: 1 });
          const units = this.read<SerializedUnit[]>(K_UNITS, []);
          units.push({
            id: this.nextId(units),
            productId: item.productId,
            serialNumber: serial,
            currentBranchId: dto.destinationBranchId,
            status: 'Available',
          });
          this.write(K_UNITS, units);
        });
      } else {
        mov.items.push({ id: this.nextId(mov.items), productId: item.productId, quantity: item.quantity });
      }
    });

    movs.push(mov);
    this.write(K_MOVEMENTS, movs);
    return of(mov);
  }
}
