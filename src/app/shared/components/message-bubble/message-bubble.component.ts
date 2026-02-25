import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ChatMessage } from '../../../core/models';
import { RelativeTimePipe } from '../../pipes/relative-time.pipe';

/**
 * Composant de bulle de message réutilisable.
 *
 * Affiche un message avec un style différent selon le type d'expéditeur
 * (client, agent ou système). Utilise OnPush pour optimiser les performances
 * conformément aux bonnes pratiques Angular.
 */
@Component({
  selector: 'app-message-bubble',
  standalone: true,
  imports: [CommonModule, MatIconModule, RelativeTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="message-bubble"
      [class.message--client]="message.senderType === 'client'"
      [class.message--agent]="message.senderType === 'agent'"
      [class.message--system]="message.senderType === 'system'"
    >
      <!-- Message système -->
      <div *ngIf="message.senderType === 'system'" class="message__system">
        <mat-icon class="message__system-icon">info</mat-icon>
        <span>{{ message.content }}</span>
      </div>

      <!-- Message client ou agent -->
      <div *ngIf="message.senderType !== 'system'" class="message__content">
        <div class="message__header">
          <span class="message__sender">
            {{ message.senderType === 'client' ? 'Vous' : agentLabel }}
          </span>
          <span class="message__time">{{ message.timestamp | relativeTime }}</span>
        </div>
        <p class="message__text">{{ message.content }}</p>
      </div>
    </div>
  `,
  styles: [`
    .message-bubble {
      display: flex;
      margin-bottom: 8px;
      max-width: 80%;
    }

    .message--client {
      margin-left: auto;

      .message__content {
        background-color: #1976d2;
        color: white;
        border-radius: 16px 16px 4px 16px;
      }

      .message__sender { color: rgba(255,255,255, 0.8); }
      .message__time   { color: rgba(255,255,255, 0.6); }
    }

    .message--agent {
      margin-right: auto;

      .message__content {
        background-color: #f5f5f5;
        color: #212121;
        border-radius: 16px 16px 16px 4px;
      }

      .message__sender { color: #1976d2; }
      .message__time   { color: #9e9e9e; }
    }

    .message--system {
      margin: 4px auto;
      max-width: 100%;
    }

    .message__system {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #757575;
      font-style: italic;
      padding: 4px 12px;
      background: #fafafa;
      border-radius: 12px;
    }

    .message__system-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #9e9e9e;
    }

    .message__content {
      padding: 8px 14px;
      word-break: break-word;
    }

    .message__header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
      margin-bottom: 2px;
    }

    .message__sender {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .message__time {
      font-size: 10px;
      white-space: nowrap;
    }

    .message__text {
      margin: 0;
      font-size: 14px;
      line-height: 1.4;
    }
  `]
})
export class MessageBubbleComponent {
  /** Message à afficher */
  @Input({ required: true }) message!: ChatMessage;

  /** Label affiché pour l'agent (par défaut "Conseiller") */
  @Input() agentLabel = 'Conseiller';
}
