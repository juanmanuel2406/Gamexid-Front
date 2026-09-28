# Gamexid — prueba de interfaz técnica

## Estado

Implementación local en la rama `experiment/gamexid-tech-ui`. No publicada ni subida a GitHub en esta intervención. La versión anterior se conserva en la etiqueta `gamexid-before-tech-ui-20260928`, tanto en Front como en Back.

El inventario sigue siendo un piloto con almacenamiento en el navegador: productos, unidades y movimientos en localStorage; pedidos y PDF en IndexedDB. El acceso usa el servicio ASP.NET existente. El ERP y la base de datos empresarial aún no están conectados. La interfaz informa estas limitaciones y no simula conexiones a Railway o al ERP.

## Plan aplicado

1. Conservar el punto de retorno antes de modificar ambos repositorios.
2. Sustituir Bootstrap e iconos por Tailwind 4, PrimeNG 20 y Lucide.
3. Separar configuración, rutas y pantallas standalone. Usar Signals para estado y valores derivados; conservar RxJS para solicitudes.
4. Rediseñar navegación, métricas y formularios sin cambiar las claves de los datos existentes.
5. Incorporar ingesta de PDF local, extracción explícita con Gemini y auditoría de seriales.
6. Limitar Anime.js y GSAP a señales operativas y al logo del login. Respetar movimiento reducido.
7. Verificar compilación, flujos de navegador, tamaños móviles y dependencias.

## Archivos principales

| Área | Archivos |
| --- | --- |
| Inicio y rutas | src/main.ts, src/app/app.config.ts, src/app/app.routes.ts |
| Tema | .postcssrc.json, src/styles.css, angular.json, package.json, package-lock.json |
| Navegación y sucursal | src/app/app.ts, app.html, app.css, core/workspace.ts |
| Pantallas | src/app/components-fastscan/{login,dashboard,productos,ingresos,sucursales}/* |
| PDF y Gemini | src/app/features/intake/* |
| Linaje y devoluciones | src/app/features/audit/* |
| Iconos, búsqueda y animación | src/app/shared/{icon,highlight,motion}.ts |
| Acceso y servicios conservados | src/app/guards/auth.guard.ts, src/app/services-fastscan/* |
| Pruebas | e2e/workflows.spec.ts, playwright.config.ts |

Se retiraron AppModule, el módulo de rutas y la configuración de pruebas Karma sin pruebas asociadas. Se eliminaron los comentarios decorativos del servicio. Se conserva la documentación útil y las marcas de código generado de las migraciones.

## Dependencias

- Tailwind CSS 4 con Typography y Scrollbar, usado junto al tema oscuro de PrimeNG.
- PrimeNG 20: tablas, paginación, virtual scroll, diálogos, etiquetas, tooltips, pasos, skeletons y notificaciones.
- @lucide/angular: iconos lineales seleccionados.
- Anime.js: logo de login, captura y láser. GSAP: aviso de discrepancia.
- Inter y JetBrains Mono locales mediante @fontsource.
- PDF.js cargado bajo demanda; Angular, RxJS y Zone.js conservados.
- Bootstrap, Bootstrap Icons, platform-browser-dynamic y dependencias directas Jasmine/Karma retiradas. Angular puede conservar dependencias opcionales transitivas de herramientas.
- Backend: se mantienen los paquetes usados por autenticación, EF Core, MySQL y migraciones.

## Comportamiento y límites

- El selector usa sucursales reales del piloto, no nombres de ejemplo inventados.
- Los KPIs y el gráfico se calculan sobre registros locales. Sin datos anteriores no se inventa un porcentaje.
- EAN primero; luego cantidad esperada y seriales. Se bloquean cantidades incompletas o seriales repetidos.
- Un lector USB/Bluetooth en modo teclado puede completar los campos y enviar Enter. No es posible certificar hardware físico que no está conectado ni identificar con fiabilidad un scanner mediante el navegador.
- Sonido/vibración requieren activación del usuario y soporte del dispositivo.
- El PDF se analiza localmente al seleccionarlo. Solo «Extraer con Gemini» lo transmite a Google, a través del servidor autenticado.
- Gemini no se activa sin clave y modelo configurados en el servidor. No hay claves en el front.
- Las cantidades escritas manualmente se conservan; Gemini completa las pendientes. La confianza es una estimación de IA, no una garantía.
- La auditoría local relaciona componentes existentes con un gabinete y conserva comparaciones. Una discrepancia requiere revisión humana; no prueba fraude ni modifica stock.
- Este piloto no sustituye una auditoría central e inmutable: el almacenamiento del navegador puede editarse o borrarse.

## Verificación

`npm run build` compila producción. `npm test` ejecuta pruebas en Edge local. Los tests interceptan los endpoints de acceso y Gemini: verifican la interfaz, no una conexión real a Google.

Se cubren creación de productos, ingreso EAN/serial, duplicados, recepción parcial persistente, rechazo de PDF falso, extracción local, envío explícito a Gemini, auditoría persistente y navegación móvil sin desborde.

En Back: `dotnet build FastScan.sln`, `dotnet build Gamexid.Access/Gamexid.Access.csproj` y `dotnet run --project Gamexid.Access.Checks`.

## Antes de publicar

1. Revisar esta prueba visual.
2. Configurar Gemini en el servidor y probar con un documento autorizado de prueba. Ver el documento GEMINI.md del Back.
3. Guardar una copia del artefacto publicado y de la configuración Nginx.
4. Publicar front y servicio de acceso juntos; aplicar la ruta Nginx específica de extracción.
5. Probar login real, scanner físico y una extracción real. No se han realizado estas pruebas externas en esta intervención.
6. Mantener HTML sin caché y archivos con hash con caché larga. Los metadatos HTML por sí solos no sustituyen los encabezados del servidor.

## Cómo volver atrás

La etiqueta anterior no borra ni sobrescribe el trabajo nuevo. Crear una carpeta de trabajo separada desde `gamexid-before-tech-ui-20260928`, instalar con `npm ci` y compilar. En Back, publicar el servicio desde la misma etiqueta. Solo reemplazar artefactos del servidor tras guardar los actuales. No usar reset destructivo ni limpiar almacenamiento del navegador.

## Referencias

[Tailwind y Angular](https://tailwindcss.com/docs/installation/framework-guides/angular), [PrimeNG 20](https://v20.primeng.org/installation), [Lucide Angular](https://lucide.dev/guide/angular), [documentos en Gemini](https://ai.google.dev/gemini-api/docs/document-processing).
