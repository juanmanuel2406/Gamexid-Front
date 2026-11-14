# Gamex ID Front

```sh
npm ci
npm start
npm run build
npm test
```

El asistente está disponible en Productos y Pedidos. Envía el contexto y las
referencias de productos al backend; las claves de Gemini nunca se usan en Angular.
Las fichas ampliadas muestran las fuentes recibidas del servidor. Las sugerencias
de Google Search se muestran en un iframe aislado y los límites de cuota aparecen
como avisos, sin completar especificaciones no verificadas.

## Sucursal de trabajo y armado de PC

El selector de la cabecera define la sede para Productos, Pedidos, Sedes, inicio,
asistente y armado. El administrador puede seleccionar sedes activas; los demás
usuarios utilizan su sede asignada. El catálogo del portal se muestra separado
del inventario registrado en Gamexid y se recorre en páginas de 50 productos.

Armá tu PC utiliza el diseño por pasos: procesador, motherboard, memoria y los
demás componentes. Consulta `/api/pc-builder/options` con la sede y el armado
actual. Al cambiar la sede se borran la selección, los precios y el presupuesto
anteriores. Las verificaciones sin evidencia suficiente quedan pendientes.

El backend debe incluir `/api/catalog/products` con IDs locales de sucursal.
Consultar el [contrato del backend](https://github.com/juanmanuel2406/Gamexid-Back/blob/main/docs/armado-sucursales.md).
