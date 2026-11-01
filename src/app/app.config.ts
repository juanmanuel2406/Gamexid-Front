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
      50: '#f3f1ff',
      100: '#e6e2ff',
      200: '#cdc5ff',
      300: '#b0a4ff',
      400: '#8b7bff',
      500: '#7563f0',
      600: '#5b3fd0',
      700: '#4a32ad',
      800: '#3a278a',
      900: '#2b1d66',
      950: '#1b1240',
    },
    colorScheme: {
      dark: {
        surface: {
          0: '#ffffff',
          50: '#f1f1f3',
          100: '#d9d9de',
          200: '#b4b4bd',
          300: '#8a8a96',
          400: '#6f6f7b',
          500: '#4d4d57',
          600: '#2a2a32',
          700: '#1f1f25',
          800: '#16161a',
          900: '#0f0f12',
          950: '#08080a',
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
