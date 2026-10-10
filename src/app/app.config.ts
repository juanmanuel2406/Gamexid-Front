import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { MessageService } from 'primeng/api';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import { routes } from './app.routes';
import { netActivityInterceptor } from './core/net-activity';
const GamexidTheme = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#f5f3ff',
      100: '#ede9fe',
      200: '#ddd6fe',
      300: '#c4b5fd',
      400: '#b77cf5',
      500: '#9b38ee',
      600: '#8a2fd6',
      700: '#6d28d9',
      800: '#5b21b6',
      900: '#4c1d95',
      950: '#2e1065',
    },
    colorScheme: {
      dark: {
        surface: {
          0: '#ffffff',
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#2a3150',
          800: '#1a2034',
          900: '#0e1220',
          950: '#07090f',
        },
      },
    },
  },
});
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([(request, next) => next(
      request.url.startsWith('/api/')
        ? request.clone({ withCredentials: true, setHeaders: { 'X-Gamexid': '1' } })
        : request,
    ), netActivityInterceptor])),
    provideAnimationsAsync(),
    MessageService,
    providePrimeNG({
      theme: {
        preset: GamexidTheme,
        options: {
          darkModeSelector: '.gamexid-dark',
          cssLayer: { name: 'primeng', order: 'theme, base, primeng, components, utilities' },
        },
      },
    }),
  ],
};
