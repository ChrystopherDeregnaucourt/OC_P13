import { ChatMessage } from './message.model';

/**
 * Statuts possibles d'une session de chat.
 * Correspond à l'enum `session_status` de la BDD.
 */
export type SessionStatus = 'waiting' | 'active' | 'ended';

/**
 * Modèle représentant une session de chat.
 * Correspond à la table `chat_sessions` définie dans le schéma de BDD.
 */
export interface ChatSession {
  /** Identifiant unique de la session (UUID) */
  id: string;

  /** Identifiant du client */
  clientId: string;

  /** Nom affiché du client */
  clientName: string;

  /** Identifiant de l'agent assigné (null si en attente) */
  agentId: string | null;

  /** Nom affiché de l'agent assigné */
  agentName: string | null;

  /** Statut courant de la session */
  status: SessionStatus;

  /** Historique des messages de la session */
  messages: ChatMessage[];

  /** Date de début de la session */
  startedAt: Date;

  /** Date de fin de la session (null si toujours active) */
  endedAt: Date | null;

  /** Note attribuée par le client (1 à 5) */
  rating: number | null;

  /** Commentaire libre du client */
  feedback: string | null;

  /** Sujet de la demande */
  subject?: string;
}

/**
 * Informations de position dans la file d'attente.
 */
export interface QueueInfo {
  /** Position dans la file */
  position: number;

  /** Temps d'attente estimé en minutes */
  estimatedWait: number;
}

/**
 * Données envoyées pour démarrer un chat côté client.
 */
export interface StartChatPayload {
  name: string;
  email: string;
  subject: string;
}

/**
 * Données envoyées pour évaluer une session.
 */
export interface ChatRating {
  sessionId: string;
  rating: number;
  feedback: string;
}
