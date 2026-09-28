# Gamexid Front

Interfaz Angular standalone para el piloto de inventario Gamexid.

## Desarrollo

`npm ci` instala las versiones fijadas. `npm start` inicia Angular en localhost:4200. El acceso requiere el servicio ASP.NET bajo /api/access en el mismo origen o mediante un proxy de desarrollo; no hay un login de prueba que omita la autenticación.

## Compilación y pruebas

- `npm run build`: artefacto de producción en dist/FastBack-front/browser.
- `npm test`: pruebas de interfaz con Playwright y Microsoft Edge. Inicia el servidor local y usa endpoints simulados únicamente dentro de los tests.
- `npm run test:ui`: ejecución interactiva de las pruebas.

El inventario del piloto se almacena localmente. No borrar los datos del navegador sin respaldarlos.

Consultar [el plan, los cambios y la reversión](REFACTOR-GAMEXID.md) antes de publicar esta rama experimental.
