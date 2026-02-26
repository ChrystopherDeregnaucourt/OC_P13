import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, map } from 'rxjs/operators';

// Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';

// Store
import * as ChatActions from '../../../store/chat/chat.actions';
import * as ChatSelectors from '../../../store/chat/chat.selectors';

// Composants partagés
import { MessageBubbleComponent } from '../../../shared/components/message-bubble/message-bubble.component';
import { TypingIndicatorComponent } from '../../../shared/components/typing-indicator/typing-indicator.component';

// Modèles
import { ChatMessage } from '../../../core/models';

/**
 * Composant principal de l'interface de chat pour le client.
 *
 * Implémente les fonctionnalités définies dans le Business Requirements §4.4.2 :
 * - Démarrer une session de chat en direct
 * - Échanger des messages en temps réel
 * - Consulter la file d'attente et le temps d'attente estimé
 * - Évaluer la qualité du support à la fin de la session
 */
@Component({
  selector: 'app-client-chat',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatToolbarModule,
    MatSnackBarModule,
    MatDividerModule,
    MatChipsModule,
    MatBadgeModule,
    MessageBubbleComponent,
    TypingIndicatorComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './client-chat.component.html',
  styleUrl: './client-chat.component.scss'
})
export class ClientChatComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  // Observables du store
  readonly status$ = this.store.select(ChatSelectors.selectStatus);
  readonly messages$ = this.store.select(ChatSelectors.selectMessages);
  readonly agentName$ = this.store.select(ChatSelectors.selectAgentName);
  readonly queuePosition$ = this.store.select(ChatSelectors.selectQueuePosition);
  readonly estimatedWait$ = this.store.select(ChatSelectors.selectEstimatedWait);
  readonly isAgentTyping$ = this.store.select(ChatSelectors.selectIsAgentTyping);
  readonly showRating$ = this.store.select(ChatSelectors.selectShowRating);
  readonly sessionId$ = this.store.select(ChatSelectors.selectSessionId);
  readonly error$ = this.store.select(ChatSelectors.selectError);

  // Formulaires
  startForm!: FormGroup;
  messageContent = '';
  rating = 0;
  feedback = '';
  currentSessionId: string | null = null;

  // Gestion typing debounce
  private typingSubject = new Subject<boolean>();
  private isCurrentlyTyping = false;
  private destroy$ = new Subject<void>();

  /** Sujets de support disponibles, alignés avec l'enum ticket_subject de la BDD */
  readonly subjects = [
    { value: 'reservation', label: 'Réservation' },
    { value: 'billing', label: 'Facturation' },
    { value: 'complaint', label: 'Réclamation' },
    { value: 'general', label: 'Question générale' },
    { value: 'other', label: 'Autre' }
  ];

  constructor(
    private readonly store: Store,
    private readonly fb: FormBuilder,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    // Connexion au socket
    this.store.dispatch(ChatActions.connectSocket());

    // Formulaire de démarrage
    this.startForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      subject: ['general', Validators.required]
    });

    // Gestion du debounce typing
    this.typingSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe((isTyping) => {
      if (this.currentSessionId) {
        this.store.dispatch(ChatActions.sendClientTyping({ sessionId: this.currentSessionId, isTyping }));
      }
    });

    // Stocker le sessionId localement pour l'utiliser dans les event handlers
    this.sessionId$.pipe(takeUntil(this.destroy$)).subscribe((id) => {
      this.currentSessionId = id;
    });

    // Afficher les erreurs
    this.error$.pipe(takeUntil(this.destroy$)).subscribe((error) => {
      if (error) {
        this.snackBar.open(error, 'Fermer', { duration: 5000 });
        this.store.dispatch(ChatActions.clearError());
      }
    });
  }

  /**
   * Démarre une session de chat.
   */
  onStartChat(): void {
    if (this.startForm.invalid) return;

    const { name, email, subject } = this.startForm.value;
    this.store.dispatch(ChatActions.startChat({ payload: { name, email, subject } }));
  }

  /**
   * Envoie un message.
   */
  onSendMessage(): void {
    const content = this.messageContent.trim();
    if (!content || !this.currentSessionId) return;

    this.store.dispatch(ChatActions.sendClientMessage({ sessionId: this.currentSessionId, content }));
    this.messageContent = '';
    this.onInputChange('');
    this.scrollToBottom();
  }

  /**
   * Gestion de la frappe pour l'indicateur typing.
   */
  onInputChange(value: string): void {
    const isTyping = value.length > 0;

    if (isTyping !== this.isCurrentlyTyping) {
      this.isCurrentlyTyping = isTyping;
      this.typingSubject.next(isTyping);
    }
  }

  /**
   * Gestion touche Entrée.
   */
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSendMessage();
    }
  }

  /**
   * Définit la note d'évaluation.
   */
  setRating(value: number): void {
    this.rating = value;
  }

  /**
   * Soumet l'évaluation et termine le chat.
   */
  onSubmitRating(): void {
    if (!this.currentSessionId) return;
    this.store.dispatch(ChatActions.endClientChat({
      sessionId: this.currentSessionId,
      rating: this.rating,
      feedback: this.feedback
    }));
  }

  /**
   * Fait défiler automatiquement vers le bas des messages.
   */
  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.messagesContainer) {
        const el = this.messagesContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    }, 50);
  }

  /** TrackBy pour les messages */
  trackByMessageId(_: number, msg: ChatMessage): string {
    return msg.id;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
