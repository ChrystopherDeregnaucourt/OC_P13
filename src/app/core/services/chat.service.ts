import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SocketService } from './socket.service';
import {
  ChatMessage,
  ChatSession,
  QueueInfo,
  StartChatPayload,
  AgentLoginPayload
} from '../models';

/**
 * Service métier pour la gestion du chat en temps réel.
 *
 * Encapsule la logique de communication STOMP entre le frontend Angular
 * et le serveur Support Service (Spring WebSocket + STOMP) conformément
 * à l'architecture définie dans l'ADD (§5.3.1).
 *
 * Les destinations STOMP suivent les conventions Spring :
 * - /app/...         → Messages envoyés (traités par @MessageMapping)
 * - /user/queue/...  → Messages reçus (via SimpMessagingTemplate)
 */
@Injectable({ providedIn: 'root' })
export class ChatService {
  constructor(private readonly socketService: SocketService) {}

  // =====================================================
  // ACTIONS CLIENT (envoi vers /app/...)
  // =====================================================

  /**
   * Démarre une nouvelle session de chat côté client.
   * Le serveur attribuera un agent ou placera le client en file d'attente.
   */
  startChat(payload: StartChatPayload): void {
    this.socketService.send('/app/chat.start', payload);
  }

  /**
   * Envoie un message dans une session existante (côté client).
   */
  sendClientMessage(sessionId: string, content: string): void {
    this.socketService.send('/app/chat.clientMessage', { sessionId, content });
  }

  /**
   * Notifie que le client est en train d'écrire.
   */
  sendClientTyping(sessionId: string, isTyping: boolean): void {
    this.socketService.send('/app/chat.clientTyping', { sessionId, isTyping });
  }

  /**
   * Termine la session de chat côté client avec évaluation.
   */
  endClientChat(sessionId: string, rating: number, feedback: string): void {
    this.socketService.send('/app/chat.clientEnd', { sessionId, rating, feedback });
  }

  // =====================================================
  // ACTIONS AGENT (envoi vers /app/...)
  // =====================================================

  /**
   * Connexion d'un agent au système de support.
   */
  agentLogin(payload: AgentLoginPayload): void {
    this.socketService.send('/app/agent.login', payload);
  }

  /**
   * Envoie un message dans une session (côté agent).
   */
  sendAgentMessage(sessionId: string, content: string): void {
    this.socketService.send('/app/agent.message', { sessionId, content });
  }

  /**
   * Notifie que l'agent est en train d'écrire.
   */
  sendAgentTyping(sessionId: string, isTyping: boolean): void {
    this.socketService.send('/app/agent.typing', { sessionId, isTyping });
  }

  /**
   * Change la disponibilité de l'agent.
   */
  setAgentAvailability(available: boolean): void {
    this.socketService.send('/app/agent.setAvailability', { available });
  }

  /**
   * L'agent termine une session de chat.
   */
  agentEndChat(sessionId: string): void {
    this.socketService.send('/app/agent.endChat', { sessionId });
  }

  // =====================================================
  // ÉVÉNEMENTS REÇUS DU SERVEUR (souscription /user/queue/...)
  // =====================================================

  /** Le chat a démarré et un agent a été assigné */
  onChatStarted(): Observable<{ sessionId: string; agentName: string; messages: ChatMessage[] }> {
    return this.socketService.subscribe('/user/queue/chat.started');
  }

  /** Le client a été placé en file d'attente */
  onChatQueued(): Observable<{ sessionId: string; position: number; estimatedWait: number; messages: ChatMessage[] }> {
    return this.socketService.subscribe('/user/queue/chat.queued');
  }

  /** Un agent a été assigné (depuis la file d'attente) */
  onChatAssigned(): Observable<{ sessionId: string; agentName: string }> {
    return this.socketService.subscribe('/user/queue/chat.assigned');
  }

  /** Nouveau message reçu */
  onMessage(): Observable<ChatMessage> {
    return this.socketService.subscribe('/user/queue/chat.message');
  }

  /** Mise à jour de la position dans la file */
  onQueuePosition(): Observable<QueueInfo> {
    return this.socketService.subscribe('/user/queue/chat.queuePosition');
  }

  /** Indicateur de frappe */
  onTyping(): Observable<{ sessionId: string; isTyping: boolean; from: string }> {
    return this.socketService.subscribe('/user/queue/chat.typing');
  }

  /** Chat terminé */
  onChatEnded(): Observable<{ sessionId: string; transcript?: ChatMessage[]; rating?: number; feedback?: string }> {
    return this.socketService.subscribe('/user/queue/chat.ended');
  }

  /** Demande d'évaluation (envoyée par le serveur quand l'agent termine) */
  onRatingRequested(): Observable<{ sessionId: string }> {
    return this.socketService.subscribe('/user/queue/chat.requestRating');
  }

  /** Nouvelle session assignée à l'agent */
  onNewSession(): Observable<{ sessionId: string; clientName: string; subject?: string; messages: ChatMessage[] }> {
    return this.socketService.subscribe('/user/queue/chat.newSession');
  }

  /** Agent connecté avec succès */
  onAgentLoggedIn(): Observable<{ agentId: string; name: string }> {
    return this.socketService.subscribe('/user/queue/agent.loggedIn');
  }

  /** Changement de disponibilité confirmé */
  onAvailabilityChanged(): Observable<{ available: boolean }> {
    return this.socketService.subscribe('/user/queue/agent.availabilityChanged');
  }

  /** Agent déconnecté (reçu côté client) */
  onAgentDisconnected(): Observable<{ sessionId: string }> {
    return this.socketService.subscribe('/user/queue/chat.agentDisconnected');
  }

  /** Client déconnecté */
  onClientDisconnected(): Observable<{ sessionId: string }> {
    return this.socketService.subscribe('/user/queue/chat.clientDisconnected');
  }

  /** Erreur serveur */
  onError(): Observable<{ message: string }> {
    return this.socketService.subscribe('/user/queue/errors');
  }
}
