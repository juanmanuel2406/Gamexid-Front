# Logo y sedes — revisión

Síntoma: emblema recortado en sidebar y animación inicial poco visible.

Causa: uso del PNG completo dentro de un viewport SVG ajustado y animación de entrada breve iniciada antes de cargar la imagen. Se reemplazó por el SVG vectorial y la secuencia que compartió el usuario, adaptados de Anime.js 3 a Anime.js 4.

Corrección: componente GamexidLogo reutilizable, IDs SVG únicos por instancia, secuencia de segmentos y letras, brillo y bucles, variante compacta sin letras para sidebar. Respeta movimiento reducido y cancela animaciones al destruirse o cerrar el sidebar. El área móvil de cierre ocupa únicamente el espacio exterior al menú.

Sedes: catálogo de 16 ubicaciones con las direcciones proporcionadas por el usuario. Morón es el único depósito. Los códigos GX son internos del piloto, no identificadores del ERP. La migración conserva el ID del depósito y los registros; las sedes anteriores quedan históricas y accesibles. Nuevos pedidos solo admiten sedes activas distintas del depósito.

Pruebas: e2e/workflows.spec.ts cubre 16 sedes, dirección de Belgrano, conservación de IDs, sidebar expandido, piezas SVG, referencias a degradados y movimiento reducido. La suite de 12 pruebas pasó antes de la corrección visual final de referencias SVG; se repitió la prueba específica después.

Persistencia: el catálogo todavía pertenece al piloto local del navegador. No se modificó el esquema MySQL ni se conectó el ERP.

La guía gstack-openclaw-investigate orientó el diagnóstico y la verificación visual. Aprendizaje: al convertir un SVG reutilizable, todas las referencias url(#...) deben actualizarse junto con sus IDs; una referencia inexistente puede ocultar figuras sin provocar errores de JavaScript.
