package com.ycyw.chat.model.dto;

/**
 * DTOs pour les requêtes client → serveur.
 * Utilise les records Java 21 pour la concision.
 */
public final class ClientRequests {

    private ClientRequests() {}

    /** Démarrer un chat (client:startChat) */
    public record StartChatRequest(String name, String email, String subject) {}

    /** Envoyer un message (client:message / agent:message) */
    public record SendMessageRequest(String sessionId, String content) {}

    /** Indicateur de saisie (client:typing / agent:typing) */
    public record TypingRequest(String sessionId, boolean isTyping) {}

    /** Terminer le chat avec évaluation (client:endChat) */
    public record EndChatRequest(String sessionId, int rating, String feedback) {}

    /** Connexion agent (agent:login) */
    public record AgentLoginRequest(String name, int maxChats) {}

    /** Disponibilité agent (agent:setAvailability) */
    public record AvailabilityRequest(boolean available) {}

    /** Terminer un chat côté agent (agent:endChat) */
    public record AgentEndChatRequest(String sessionId) {}
}
