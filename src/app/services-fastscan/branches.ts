import type { Branch } from './fastscan-service';

export const OFFICIAL_BRANCHES = [
  ['DEP-CENTRAL', 'Morón (Depósito Central)', 'Av. Rivadavia 17939, Morón, PBA'],
  ['GX-UNICENTER', 'Unicenter Shopping', 'Paraná 3745, Martínez, PBA'],
  ['GX-LAPLATA', 'La Plata', 'Cno. Gral. Manuel Belgrano 1550 (Local 12), Gonnet, PBA'],
  ['GX-SANMIGUEL', 'San Miguel', 'Paunero 1373, San Miguel, PBA'],
  ['GX-SANISIDRO', 'San Isidro', 'Av. Centenario 239, San Isidro, PBA'],
  ['GX-MERLO', 'Merlo', 'Suipacha 509, Merlo, PBA'],
  ['GX-CATAN1', 'González Catán I', 'Av. José Equiza 4247, González Catán, PBA'],
  ['GX-CATAN2', 'González Catán II', 'Dr. Enrique Simón Pérez 4429, González Catán, PBA'],
  ['GX-BELGRANO', 'Belgrano', 'José Hernández 2438, CABA'],
  ['GX-ABASTO', 'Abasto Shopping', 'Av. Corrientes 3247 (Nivel 1 - Local 2045), CABA'],
  ['GX-PALERMO', 'Palermo', 'Serrano 1406, CABA'],
  ['GX-CABALLITO', 'Caballito', 'Av. Rivadavia 5040 (Local 14, Galería Vía Cavour), CABA'],
  ['GX-LINIERS', 'Liniers', 'Av. Rivadavia 11063, CABA'],
  ['GX-MARDELPLATA', 'Mar del Plata', 'San Martín 3160, Mar del Plata, PBA'],
  ['GX-MENDOZA', 'Mendoza', 'Lavalle 334, Mendoza'],
  [
    'GX-CORRIENTES',
    'Corrientes',
    'Av. Raúl Alfonsín 3525 (Local 108, Shopping Centenario), Corrientes',
  ],
] as const;

export function reconcileBranches(previous: Branch[]): Branch[] {
  const remaining = [...previous];
  let nextId = Math.max(2, ...previous.map((branch) => branch.id)) + 1;
  const official = OFFICIAL_BRANCHES.map(([code, name, address]) => {
    const existing = remaining.find(
      (branch) =>
        branch.code === code ||
        branch.name === name ||
        (code === 'DEP-CENTRAL' && /dep[oó]sito/i.test(branch.name)),
    );
    if (existing) remaining.splice(remaining.indexOf(existing), 1);
    return {
      id:
        existing?.id ??
        (code === 'DEP-CENTRAL' && !previous.some((b) => b.id === 2) ? 2 : nextId++),
      code,
      name,
      address,
      isActive: true,
    };
  });
  return [
    ...official,
    ...remaining.map((branch) => ({ ...branch, isActive: false, isLegacy: true })),
  ];
}
