import { ApplicationConfig, isDevMode } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';

import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { chatReducer } from './store/chat/chat.reducer';
import { ChatEffects } from './store/chat/chat.effects';

/**
 * Configuration racine de l'application Angular.
 *
 * Intègre :
 * - Le routing avec lazy-loading
 * - Les animations Angular Material
 * - Le store NgRx (gestion d'état réactive - pattern Redux)
 * - Les effets NgRx pour la communication STOMP WebSocket
 * - Les DevTools NgRx en mode développement
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    provideAnimationsAsync(),
    provideStore({ chat: chatReducer }),
    provideEffects([ChatEffects]),
    provideStoreDevtools({
      maxAge: 25,
      logOnly: !isDevMode(),
      autoPause: true
    })
  ]
};
