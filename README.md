# Gamexid Front

Interfaz Angular standalone para el piloto de inventario Gamexid.

## Desarrollo

`npm ci` instala las versiones fijadas. `npm start` inicia Angular en localhost:4200. Iniciar primero **Gamexid.Api** en el backend (puerto 5000). El proxy incluido envía `/api` a esa API; no hay un login de prueba que omita la autenticación.

## Compilación y pruebas

- `npm run build`: artefacto de producción en dist/Gamexid-Front/browser.
- `npm test`: pruebas de interfaz con Playwright y Microsoft Edge. Inicia el servidor local y usa endpoints simulados únicamente dentro de los tests.
- `npm run test:ui`: ejecución interactiva de las pruebas.

Productos, sucursales, unidades e ingresos usan la API con MySQL en Aiven.
Los pedidos y controles de auditoría todavía se guardan localmente; no borrar los
datos del navegador sin respaldarlos. Los almacenes del piloto anterior se conservan
separados: no se vinculan sus IDs automáticamente con los de la nueva base.

PdfPig extrae el PDF en el backend al pulsar el botón correspondiente. PDF.js se
mantiene para la vista previa. No se envían documentos a Google.

La prueba `e2e/live-api.spec.ts` se omite por defecto. Requiere habilitar una
contraseña de aplicación mediante `GAMEXID_LIVE_PASSWORD` en el entorno privado,
y tener la API local conectada a Aiven. No guardar ese valor en el repositorio.

## Pantallas y endpoints

| Pantalla | Ruta | Datos |
| --- | --- | --- |
| Operaciones | `/dashboard` | `GET /api/products`, `/api/products/{id}/units`, `/api/inventory/movements`, `/api/access/health`, `/api/access/integrations`, `/api/access/gc/status` |
| Ingresos | `/ingresos` | `GET /api/products/lookup`, `POST /api/products`, `POST /api/inventory/receipts` (destino: Depósito Central) |
| Productos | `/productos` | `GET/POST /api/products`, unidades por producto |
| Sedes | `/sedes` | `GET /api/branches`; `POST /api/branches` solo para administradores |
| Movimientos | `/movimientos` | `GET /api/inventory/movements` con filtros por tipo, sede y texto |
| Pedidos | `/sucursales` | Pedidos locales (IndexedDB) y `POST /api/documents/extract` (PdfPig) |
| Linaje | `/auditoria` | Controles locales de gabinete y componentes |
| GC-API | `/integracion` | `GET /api/access/gc/*`, solo lectura |

`InventoryStore` (src/app/core) concentra productos, unidades y movimientos. Consulta
movimientos cada 15 segundos mientras la pestaña está visible y vuelve a leer las
unidades solo cuando aparece un movimiento nuevo. El stock por sede se calcula con las
unidades disponibles que devuelve la API; no hay datos simulados en la aplicación.

`NetActivity` registra las solicitudes reales a `/api`: alimenta la barra de carga del
encabezado y el indicador de la última respuesta (método, ruta, estado y tiempo).

Las animaciones usan Anime.js (`src/app/shared/anim.ts`): apertura del login, entrada
de vistas, contadores, barras, reordenamiento del stock por sede, expansión de sedes,
láser del scanner y confirmación de ingresos. Con movimiento reducido se desactivan.
Atajos de teclado: 1 a 8 para cambiar de pantalla.

Consultar [el plan, los cambios y la reversión](REFACTOR-GAMEXID.md) antes de publicar esta rama experimental.
