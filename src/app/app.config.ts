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
      50: '#f4f1fc',
      100: '#ebe6f8',
      200: '#d6cdf2',
      300: '#b6a7e8',
      400: '#8d77dc',
      500: '#5b3fd0',
      600: '#4a32ad',
      700: '#3c288c',
      800: '#2f2070',
      900: '#241856',
      950: '#170f38',
    },
    colorScheme: {
      light: {
        surface: {
          0: '#fffefa',
          50: '#fbf9f4',
          100: '#f6f2ea',
          200: '#ece6da',
          300: '#e2dacb',
          400: '#d0c5b0',
          500: '#a59a85',
          600: '#7d7464',
          700: '#655d4e',
          800: '#3d382e',
          900: '#2a261f',
          950: '#1f1c16',
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
