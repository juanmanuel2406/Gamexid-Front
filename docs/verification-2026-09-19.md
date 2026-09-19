# Revisión funcional Gamexid

## Corregido y cubierto por pruebas

- Formularios invisibles: Bootstrap ocultaba la clase modal. Se aplica un estilo limitado a nuestros diálogos.
- Los clics dentro del fondo no deben devolver false: Angular cancela la acción predeterminada y bloqueaba los checkboxes. Se devuelve null para clics internos.
- Alta de producto con validaciones y cierre por Escape.
- Ingreso exclusivamente a Depósito, notas cortas opcionales, carga por EAN y serial manual o lector de teclado.
- Seriales repetidos y cantidades inválidas rechazados antes de guardar.
- Pedidos con PDF textual, asociación exacta por EAN, cantidades revisadas manualmente y recepción parcial persistida en IndexedDB.
- PDF falso rechazado; PDF de imagen requiere carga manual. Gemini no está conectado.
- Menú por hover en escritorio y botón en móvil. Sin selectores de tema o idioma.
- Logo original con encuadre SVG y animación anime.js, respetando movimiento reducido.
- Acceso requiere sesión comprobada por el servidor. No confiar en sessionStorage como autenticación.

## Publicación y verificación

Activar primero Gamexid.Access del repositorio backend. Publicar la compilación Angular y aplicar deploy/nginx-gamexid-cache.conf en Nginx (HTML sin caché y MIME JavaScript para el lector PDF).

Ejecutar `npx playwright test`, `npm run build` y `npm audit --omit=dev`.
Luego ejecutar `node scripts/verify-access.cjs https://juanmi.goodlycomunicacion.com` e ingresar la contraseña por entrada estándar. No se guarda.

## Límites pendientes

Los movimientos y productos todavía usan localStorage y los pedidos IndexedDB: no existe sincronización entre computadoras, usuarios o teléfonos. No borrar datos del navegador como método de actualización. La conexión a la base de datos/API empresarial y Gemini requiere un siguiente trabajo antes de uso operativo.

Las pruebas de lector simulan entrada por teclado. Falta probar físicamente el modelo de scanner USB/Bluetooth. Un lector HID se comporta como teclado y el navegador no puede asegurar que está físicamente conectado; el aviso indica ausencia de lectura, no una detección falsa.

Aprendizaje de depuración: comprobar estilos heredados de Bootstrap y valores devueltos por manejadores Angular al investigar diálogos visibles sin interacción.
