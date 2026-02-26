/**
 * Modèle représentant un agent du support client.
 * Correspond à la table `support_agents` définie dans le schéma de BDD.
 */
export interface SupportAgent {
  /** Identifiant unique de l'agent (UUID) */
  id: string;

  /** Nom affiché de l'agent */
  name: string;

  /** Indique si l'agent est disponible pour de nouvelles sessions */
  available: boolean;

  /** Nombre maximum de sessions simultanées */
  maxChats: number;

  /** Nombre de sessions actuellement gérées */
  currentChats: number;
}

/**
 * Données envoyées lors de la connexion d'un agent.
 */
export interface AgentLoginPayload {
  name: string;
  maxChats?: number;
}
