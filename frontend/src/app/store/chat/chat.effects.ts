import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { tap, map, switchMap, takeUntil, merge as mergeWith } from 'rxjs';
import { merge } from 'rxjs';
import { ChatService, StompService } from '../../core/services';
import * as ChatActions from './chat.actions';

/**
 * Effets NgRx pour le module Chat.
 *
 * Orchestre la communication entre le store NgRx et les services
 * STOMP/WebSocket, conformément au pattern Redux/NgRx.
 */
@Injectable()
export class ChatEffects {
  constructor(
    private readonly actions$: Actions,
    private readonly chatService: ChatService,
    private readonly stompService: StompService
  ) {}

  // ── Connexion STOMP ─────────────────────────────

  /**
   * Connecte le client STOMP et écoute tous les événements serveur.
   */
  connectSocket$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.connectSocket),
      switchMap(() => {
        this.stompService.connect();

        return merge(
          // Événements client
          this.chatService.onChatStarted().pipe(
            map(({ sessionId, agentName, messages }) =>
              ChatActions.chatStarted({ sessionId, agentName, messages })
            )
          ),
          this.chatService.onChatQueued().pipe(
            map(({ sessionId, position, estimatedWait, messages }) =>
              ChatActions.chatQueued({ sessionId, position, estimatedWait, messages })
            )
          ),
          this.chatService.onChatAssigned().pipe(
            map(({ sessionId, agentName }) =>
              ChatActions.chatAssigned({ sessionId, agentName })
            )
          ),
          this.chatService.onMessage().pipe(
            map((message) => ChatActions.messageReceived({ message }))
          ),
          this.chatService.onTyping().pipe(
            map(({ sessionId, isTyping, from }) =>
              ChatActions.typingIndicator({ sessionId, isTyping, from })
            )
          ),
          this.chatService.onChatEnded().pipe(
            map(({ sessionId, transcript, rating, feedback }) =>
              ChatActions.chatEnded({ sessionId, transcript, rating, feedback })
            )
          ),
          this.chatService.onRatingRequested().pipe(
            map(({ sessionId }) => ChatActions.ratingRequested({ sessionId }))
          ),
          this.chatService.onQueuePosition().pipe(
            map(({ position, estimatedWait }) =>
              ChatActions.queuePositionUpdated({ position, estimatedWait })
            )
          ),

          // Événements agent
          this.chatService.onAgentLoggedIn().pipe(
            map(({ agentId, name }) => ChatActions.agentLoggedIn({ agentId, name }))
          ),
          this.chatService.onNewSession().pipe(
            map(({ sessionId, clientName, subject, messages }) =>
              ChatActions.newSessionAssigned({ sessionId, clientName, subject, messages })
            )
          ),
          this.chatService.onAvailabilityChanged().pipe(
            map(({ available }) => ChatActions.agentAvailabilityChanged({ available }))
          ),
          this.chatService.onAgentDisconnected().pipe(
            map(({ sessionId }) => ChatActions.agentDisconnected({ sessionId }))
          ),
          this.chatService.onClientDisconnected().pipe(
            map(({ sessionId }) => ChatActions.clientDisconnected({ sessionId }))
          ),

          // Erreurs
          this.chatService.onError().pipe(
            map(({ message }) => ChatActions.chatError({ message }))
          )
        );
      })
    )
  );

  // ── Actions Client ───────────────────────────────

  startChat$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ChatActions.startChat),
        tap(({ payload }) => this.chatService.startChat(payload))
      ),
    { dispatch: false }
  );

  sendClientMessage$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ChatActions.sendClientMessage),
        tap(({ sessionId, content }) =>
          this.chatService.sendClientMessage(sessionId, content)
        )
      ),
    { dispatch: false }
  );

  sendClientTyping$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ChatActions.sendClientTyping),
        tap(({ sessionId, isTyping }) =>
          this.chatService.sendClientTyping(sessionId, isTyping)
        )
      ),
    { dispatch: false }
  );

  endClientChat$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ChatActions.endClientChat),
        tap(({ sessionId, rating, feedback }) =>
          this.chatService.endClientChat(sessionId, rating, feedback)
        )
      ),
    { dispatch: false }
  );

  // ── Actions Agent ────────────────────────────────

  agentLogin$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ChatActions.agentLogin),
        tap(({ payload }) => this.chatService.agentLogin(payload))
      ),
    { dispatch: false }
  );

  sendAgentMessage$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ChatActions.sendAgentMessage),
        tap(({ sessionId, content }) =>
          this.chatService.sendAgentMessage(sessionId, content)
        )
      ),
    { dispatch: false }
  );

  sendAgentTyping$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ChatActions.sendAgentTyping),
        tap(({ sessionId, isTyping }) =>
          this.chatService.sendAgentTyping(sessionId, isTyping)
        )
      ),
    { dispatch: false }
  );

  setAgentAvailability$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ChatActions.setAgentAvailability),
        tap(({ available }) => this.chatService.setAgentAvailability(available))
      ),
    { dispatch: false }
  );

  agentEndChat$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ChatActions.agentEndChat),
        tap(({ sessionId }) => this.chatService.agentEndChat(sessionId))
      ),
    { dispatch: false }
  );
}
