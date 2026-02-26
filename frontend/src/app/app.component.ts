import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Composant racine de l'application Your Car Your Way - POC Chat.
 * Sert de shell et délègue le rendu aux routes enfants.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
  styles: [`:host { display: block; height: 100vh; }`]
})
export class AppComponent {}
