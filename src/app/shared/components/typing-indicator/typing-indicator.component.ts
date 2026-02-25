import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * Composant affichant une animation de frappe (trois points animés).
 * Affiché lorsque l'interlocuteur est en train d'écrire un message.
 */
@Component({
  selector: 'app-typing-indicator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="typing-indicator">
      <span class="typing-indicator__dot"></span>
      <span class="typing-indicator__dot"></span>
      <span class="typing-indicator__dot"></span>
      <span class="typing-indicator__label">En train d'écrire…</span>
    </div>
  `,
  styles: [`
    .typing-indicator {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 8px 14px;
      background: #f5f5f5;
      border-radius: 16px;
      margin-bottom: 8px;
    }

    .typing-indicator__dot {
      width: 6px;
      height: 6px;
      background-color: #9e9e9e;
      border-radius: 50%;
      animation: bounce 1.4s infinite;

      &:nth-child(2) { animation-delay: 0.2s; }
      &:nth-child(3) { animation-delay: 0.4s; }
    }

    .typing-indicator__label {
      font-size: 12px;
      color: #757575;
      margin-left: 6px;
      font-style: italic;
    }

    @keyframes bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-4px); }
    }
  `]
})
export class TypingIndicatorComponent {}
