import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { StompService } from './stomp.service';
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
 * Encapsule la logique de communication entre le frontend Angular
 * et le serveur Spring Boot via STOMP/WebSocket.
 *
 * Ce service correspond au composant « Support Module » de la couche
 * Présentation définie dans le diagramme de composants (§5.3.1).
 *
 * Mapping Socket.IO → STOMP :
 * - emit('client:startChat', data)  → send('/client.startChat', data)
 * - on('chat:started')              → subscribe('/queue/chat.started')
 */
@Injectable({ providedIn: 'root' })
export class ChatService {
  constructor(private readonly stompService: StompService) {}

  // =====================================================
  // ACTIONS CLIENT
  // =====================================================

  /**
   * Démarre une nouvelle session de chat côté client.
   * Le serveur attribuera un agent ou placera le client en file d'attente.
   */
  startChat(payload: StartChatPayload): void {
    this.stompService.send('/client.startChat', payload);
  }

  /**
   * Envoie un message dans une session existante (côté client).
   */
  sendClientMessage(sessionId: string, content: string): void {
    this.stompService.send('/client.message', { sessionId, content });
  }

  /**
   * Notifie que le client est en train d'écrire.
   */
  sendClientTyping(sessionId: string, isTyping: boolean): void {
    this.stompService.send('/client.typing', { sessionId, isTyping });
  }

  /**
   * Termine la session de chat côté client avec évaluation.
   */
  endClientChat(sessionId: string, rating: number, feedback: string): void {
    this.stompService.send('/client.endChat', { sessionId, rating, feedback });
  }

  // =====================================================
  // ACTIONS AGENT
  // =====================================================

  /**
   * Connexion d'un agent au système de support.
   */
  agentLogin(payload: AgentLoginPayload): void {
    this.stompService.send('/agent.login', payload);
  }

  /**
   * Envoie un message dans une session (côté agent).
   */
  sendAgentMessage(sessionId: string, content: string): void {
    this.stompService.send('/agent.message', { sessionId, content });
  }

  /**
   * Notifie que l'agent est en train d'écrire.
   */
  sendAgentTyping(sessionId: string, isTyping: boolean): void {
    this.stompService.send('/agent.typing', { sessionId, isTyping });
  }

  /**
   * Change la disponibilité de l'agent.
   */
  setAgentAvailability(available: boolean): void {
    this.stompService.send('/agent.setAvailability', { available });
  }

  /**
   * L'agent termine une session de chat.
   */
  agentEndChat(sessionId: string): void {
    this.stompService.send('/agent.endChat', { sessionId });
  }

  // =====================================================
  // ÉVÉNEMENTS REÇUS DU SERVEUR (via STOMP subscriptions)
  // =====================================================

  /** Le chat a démarré et un agent a été assigné */
  onChatStarted(): Observable<{ sessionId: string; agentName: string; messages: ChatMessage[] }> {
    return this.stompService.subscribe('/queue/chat.started');
  }

  /** Le client a été placé en file d'attente */
  onChatQueued(): Observable<{ sessionId: string; position: number; estimatedWait: number; messages: ChatMessage[] }> {
    return this.stompService.subscribe('/queue/chat.queued');
  }

  /** Un agent a été assigné (depuis la file d'attente) */
  onChatAssigned(): Observable<{ sessionId: string; agentName: string }> {
    return this.stompService.subscribe('/queue/chat.assigned');
  }

  /** Nouveau message reçu */
  onMessage(): Observable<ChatMessage> {
    return this.stompService.subscribe('/queue/chat.message');
  }

  /** Mise à jour de la position dans la file */
  onQueuePosition(): Observable<QueueInfo> {
    return this.stompService.subscribe('/queue/chat.queuePosition');
  }

  /** Indicateur de frappe */
  onTyping(): Observable<{ sessionId: string; isTyping: boolean; from: string }> {
    return this.stompService.subscribe('/queue/chat.typing');
  }

  /** Chat terminé */
  onChatEnded(): Observable<{ sessionId: string; transcript?: ChatMessage[]; rating?: number; feedback?: string }> {
    return this.stompService.subscribe('/queue/chat.ended');
  }

  /** Demande d'évaluation (envoyée par le serveur quand l'agent termine) */
  onRatingRequested(): Observable<{ sessionId: string }> {
    return this.stompService.subscribe('/queue/chat.requestRating');
  }

  /** Nouvelle session assignée à l'agent */
  onNewSession(): Observable<{ sessionId: string; clientName: string; subject?: string; messages: ChatMessage[] }> {
    return this.stompService.subscribe('/queue/chat.newSession');
  }

  /** Agent connecté avec succès */
  onAgentLoggedIn(): Observable<{ agentId: string; name: string }> {
    return this.stompService.subscribe('/queue/agent.loggedIn');
  }

  /** Changement de disponibilité confirmé */
  onAvailabilityChanged(): Observable<{ available: boolean }> {
    return this.stompService.subscribe('/queue/agent.availabilityChanged');
  }

  /** Agent déconnecté (reçu côté client) */
  onAgentDisconnected(): Observable<{ sessionId: string }> {
    return this.stompService.subscribe('/queue/chat.agentDisconnected');
  }

  /** Client déconnecté */
  onClientDisconnected(): Observable<{ sessionId: string }> {
    return this.stompService.subscribe('/queue/chat.clientDisconnected');
  }

  /** Erreur serveur */
  onError(): Observable<{ message: string }> {
    return this.stompService.subscribe('/queue/errors');
  }
}
