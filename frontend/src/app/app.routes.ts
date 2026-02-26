import { Routes } from '@angular/router';

/**
 * Routes principales de l'application.
 *
 * Utilisation du lazy loading pour chaque feature module,
 * conformément aux bonnes pratiques Angular (code splitting).
 */
export const routes: Routes = [
  {
    path: '',
    redirectTo: 'chat',
    pathMatch: 'full'
  },
  {
    path: 'chat',
    loadComponent: () =>
      import('./features/client/client-chat/client-chat.component').then(
        (m) => m.ClientChatComponent
      ),
    title: 'Your Car Your Way - Chat Support'
  },
  {
    path: 'agent',
    loadComponent: () =>
      import('./features/agent/agent-dashboard/agent-dashboard.component').then(
        (m) => m.AgentDashboardComponent
      ),
    title: 'Your Car Your Way - Console Agent'
  },
  {
    path: '**',
    redirectTo: 'chat'
  }
];
