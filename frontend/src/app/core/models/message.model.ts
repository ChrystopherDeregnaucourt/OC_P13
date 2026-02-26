/**
 * Modèle représentant un message dans une session de chat.
 * Correspond à la table `chat_messages` définie dans le schéma de BDD.
 */
export interface ChatMessage {
  /** Identifiant unique du message (UUID) */
  id: string;

  /** Identifiant de l'expéditeur */
  senderId: string;

  /** Type d'expéditeur : client, agent ou système */
  senderType: SenderType;

  /** Contenu textuel du message */
  content: string;

  /** URL d'une pièce jointe optionnelle */
  attachmentUrl?: string;

  /** Date et heure d'envoi */
  timestamp: Date;

  /** Identifiant de session (utilisé côté agent pour gérer plusieurs sessions) */
  sessionId?: string;
}

/**
 * Types d'expéditeur alignés avec l'enum `sender_type` de la BDD.
 */
export type SenderType = 'client' | 'agent' | 'system';
