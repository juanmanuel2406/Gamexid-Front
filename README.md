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

Consultar [el plan, los cambios y la reversión](REFACTOR-GAMEXID.md) antes de publicar esta rama experimental.
