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
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';

// Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatBadgeModule } from '@angular/material/badge';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';

// Store
import * as ChatActions from '../../../store/chat/chat.actions';
import * as ChatSelectors from '../../../store/chat/chat.selectors';
import { AgentSession } from '../../../store/chat/chat.reducer';

// Composants partagés
import { MessageBubbleComponent } from '../../../shared/components/message-bubble/message-bubble.component';
import { TypingIndicatorComponent } from '../../../shared/components/typing-indicator/typing-indicator.component';

// Modèles
import { ChatMessage } from '../../../core/models';

/**
 * Composant du tableau de bord agent pour le support client.
 *
 * Permet à un agent de :
 * - Se connecter au système de support
 * - Gérer plusieurs sessions de chat simultanément
 * - Envoyer et recevoir des messages en temps réel
 * - Changer sa disponibilité
 * - Terminer les sessions
 *
 * Correspond au rôle "Support Client" défini dans l'architecture métier (§5.1.1).
 */
@Component({
  selector: 'app-agent-dashboard',
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
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatBadgeModule,
    MatSlideToggleModule,
    MatDividerModule,
    MatChipsModule,
    MatSnackBarModule,
    MessageBubbleComponent,
    TypingIndicatorComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agent-dashboard.component.html',
  styleUrl: './agent-dashboard.component.scss'
})
export class AgentDashboardComponent implements OnInit, OnDestroy {
  @ViewChild('agentMessagesContainer') private messagesContainer!: ElementRef;

  // Observables du store
  readonly agentId$ = this.store.select(ChatSelectors.selectAgentId);
  readonly agentName$ = this.store.select(ChatSelectors.selectAgentNameSelf);
  readonly agentAvailable$ = this.store.select(ChatSelectors.selectAgentAvailable);
  readonly agentSessions$ = this.store.select(ChatSelectors.selectAgentSessions);
  readonly activeSessions$ = this.store.select(ChatSelectors.selectActiveAgentSessions);
  readonly activeSession$ = this.store.select(ChatSelectors.selectActiveSession);
  readonly activeSessionId$ = this.store.select(ChatSelectors.selectActiveSessionId);
  readonly error$ = this.store.select(ChatSelectors.selectError);

  // Formulaire de connexion
  loginForm!: FormGroup;
  messageContent = '';

  // Typing debounce
  private typingSubject = new Subject<{ sessionId: string; isTyping: boolean }>();
  private destroy$ = new Subject<void>();

  constructor(
    private readonly store: Store,
    private readonly fb: FormBuilder,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.store.dispatch(ChatActions.connectSocket());

    this.loginForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      maxChats: [3, [Validators.required, Validators.min(1), Validators.max(10)]]
    });

    // Debounce typing agent
    this.typingSubject.pipe(
      debounceTime(300),
      distinctUntilChanged((a, b) => a.sessionId === b.sessionId && a.isTyping === b.isTyping),
      takeUntil(this.destroy$)
    ).subscribe(({ sessionId, isTyping }) => {
      this.store.dispatch(ChatActions.sendAgentTyping({ sessionId, isTyping }));
    });

    // Erreurs
    this.error$.pipe(takeUntil(this.destroy$)).subscribe((error) => {
      if (error) {
        this.snackBar.open(error, 'Fermer', { duration: 5000 });
        this.store.dispatch(ChatActions.clearError());
      }
    });
  }

  /**
   * Connexion de l'agent.
   */
  onLogin(): void {
    if (this.loginForm.invalid) return;

    const { name, maxChats } = this.loginForm.value;
    this.store.dispatch(ChatActions.agentLogin({ payload: { name, maxChats } }));
  }

  /**
   * Sélectionner une session active.
   */
  onSelectSession(sessionId: string): void {
    this.store.dispatch(ChatActions.selectAgentSession({ activeSessionId: sessionId }));
  }

  /**
   * Envoyer un message dans la session active.
   */
  onSendMessage(sessionId: string): void {
    const content = this.messageContent.trim();
    if (!content || !sessionId) return;

    this.store.dispatch(ChatActions.sendAgentMessage({ sessionId, content }));
    this.messageContent = '';
    this.onInputChange('', sessionId);
    this.scrollToBottom();
  }

  /**
   * Gestion de la frappe.
   */
  onInputChange(value: string, sessionId: string): void {
    this.typingSubject.next({ sessionId, isTyping: value.length > 0 });
  }

  /**
   * Gestion touche Entrée.
   */
  onKeyDown(event: KeyboardEvent, sessionId: string): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSendMessage(sessionId);
    }
  }

  /**
   * Changer la disponibilité.
   */
  onToggleAvailability(available: boolean): void {
    this.store.dispatch(ChatActions.setAgentAvailability({ available }));
  }

  /**
   * Terminer une session.
   */
  onEndSession(sessionId: string): void {
    this.store.dispatch(ChatActions.agentEndChat({ sessionId }));
  }

  /**
   * Scroll vers le bas.
   */
  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.messagesContainer) {
        const el = this.messagesContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    }, 50);
  }

  /** TrackBy pour sessions */
  trackBySessionId(_: number, session: AgentSession): string {
    return session.sessionId;
  }

  /** TrackBy pour messages */
  trackByMessageId(_: number, msg: ChatMessage): string {
    return msg.id;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
