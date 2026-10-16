# Gamex ID Front

Interfaz Angular standalone para el piloto de inventario Gamexid.

## Desarrollo

`npm ci` instala las versiones fijadas. `npm start` inicia Angular en localhost:4200. Iniciar primero **Gamexid.Api** en el backend (puerto 5000). El proxy incluido envía `/api` a esa API; no hay un login de prueba que omita la autenticación.

## Compilación y pruebas

- `npm run build`: artefacto de producción en dist/Gamexid-Front/browser.
- `npm test`: pruebas de interfaz con Playwright y Microsoft Edge. Inicia el servidor local y usa endpoints simulados únicamente dentro de los tests.
- `npm run test:ui`: ejecución interactiva de las pruebas.

Productos, sucursales, unidades e ingresos usan la API con MySQL en Aiven.
Los pedidos y seriales también usan MySQL: lista paginada por sucursal, proveedor/documento
y estado; creación con revisión humana; recepción EAN/SKU + serial por REST.
Los controles de auditoría/linaje siguen locales. Los datos históricos del navegador
se conservan, pero no se importan automáticamente ni se vuelven a escribir en IndexedDB.
Conservar los PDF originales: se guarda el JSON revisado y el nombre del archivo, no el PDF.
Ante un corte, el formulario conserva los datos mientras permanece abierto; reintentar
el mismo pedido o serial no duplica la operación. No hay guardado offline.

PdfPig extrae el PDF en el backend al pulsar el botón correspondiente. PDF.js se
mantiene para la vista previa. No se envían documentos a Google.

La prueba `e2e/live-api.spec.ts` se omite por defecto. Requiere habilitar una
contraseña de aplicación mediante `GAMEXID_LIVE_PASSWORD` en el entorno privado,
y tener la API local conectada a Aiven. No guardar ese valor en el repositorio.

## Pantallas y endpoints

| Pantalla | Ruta | Datos |
| --- | --- | --- |
| Inicio (pública) | `/` | Portada con demostración visual, funciones y acceso al sistema |
| Operaciones | `/dashboard` | `GET /api/products`, `/api/products/{id}/units`, `/api/inventory/movements`, `/api/access/health`, `/api/access/integrations`, `/api/access/gc/status` |
| Ingresos | `/ingresos` | `GET /api/products/lookup`, `POST /api/products`, `POST /api/inventory/receipts` (destino: Depósito Central) |
| Productos | `/productos` | `GET/POST /api/products`, unidades por producto |
| Sedes | `/sedes` | `GET /api/branches`; `POST /api/branches` solo para administradores |
| Movimientos | `/movimientos` | `GET /api/inventory/movements` con filtros por tipo, sede y texto |
| Pedidos | `/sucursales` | `GET/POST /api/orders`, recepción de seriales y `POST /api/documents/extract` (PdfPig) |
| Linaje | `/auditoria` | Controles locales de gabinete y componentes |
| GC-API | `/integracion` | `GET /api/access/gc/*`, solo lectura |

`InventoryStore` (src/app/core) concentra productos, unidades y movimientos. Consulta
movimientos cada 15 segundos mientras la pestaña está visible y vuelve a leer las
unidades solo cuando aparece un movimiento nuevo. El stock por sede se calcula con las
unidades disponibles que devuelve la API; la portada pública muestra ejemplos ilustrativos, separados de los datos operativos.

`NetActivity` registra las solicitudes reales a `/api`: alimenta la barra de carga del
encabezado y el indicador de la última respuesta (método, ruta, estado y tiempo).

El isotipo (`src/app/shared/gx-isotype.ts`) es una G geométrica dentro de las cuatro esquinas de un visor de scanner; su travesaño es la línea láser verde de lectura. Sistema tipográfico de tres capas (tokens en `src/styles.css`):

| Capa | Familia | Uso |
| --- | --- | --- |
| Display | Archivo variable, ancho 112 % (wordmark 125 %) | Títulos de página, secciones, modales y tarjetas |
| Interfaz | IBM Plex Sans 400/500/600 | Texto, formularios, botones, navegación y tablas |
| Datos | IBM Plex Mono 400/500/600 | Seriales, EAN-13, SKU, KPIs, horarios y etiquetas meta |

No se usan Inter, Roboto, Arial ni fuentes del sistema. Los íconos son siempre de Lucide (`<gx-icon>`); no se usan emojis ni símbolos de texto como íconos. Un test e2e verifica ambas reglas.

Las animaciones usan Anime.js (`src/app/shared/anim.ts`): apertura del login, entrada
de vistas, contadores, barras, reordenamiento del stock por sede, expansión de sedes,
láser del scanner y confirmación de ingresos. Con movimiento reducido se desactivan.
Atajos de teclado: 1 a 8 para cambiar de pantalla.

Consultar [las notas de mantenimiento](REFACTOR-GAMEXID.md) antes de publicar.

La credencial de Gaming City se configura exclusivamente en el servidor mediante `GamingCitySaaS:Iue`. Nunca debe incluirse en Angular ni en el repositorio.

Revisión del 16/10/2026: se actualizaron dependencias compatibles. Persisten 7 avisos de npm (2 moderados y 5 altos): herramientas de desarrollo y un aviso del router aplicable a SSR, que este frontend estático no utiliza. Evitar `npm audit fix --force`: propone cambios incompatibles.
