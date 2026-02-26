package com.ycyw.chat.model.dto;

import com.ycyw.chat.model.ChatMessage;
import java.util.List;

/**
 * DTOs pour les réponses serveur → client via STOMP.
 */
public final class ServerResponses {

    private ServerResponses() {}

    /** Chat démarré immédiatement (agent assigné) */
    public record ChatStartedResponse(String sessionId, String agentName, List<ChatMessage> messages) {}

    /** Client placé en file d'attente */
    public record ChatQueuedResponse(String sessionId, int position, int estimatedWait, List<ChatMessage> messages) {}

    /** Agent assigné depuis la file d'attente */
    public record ChatAssignedResponse(String sessionId, String agentName) {}

    /** Position mise à jour dans la file */
    public record QueuePositionResponse(int position, int estimatedWait) {}

    /** Indicateur de frappe relayé */
    public record TypingResponse(String sessionId, boolean isTyping, String from) {}

    /** Chat terminé */
    public record ChatEndedResponse(String sessionId, List<ChatMessage> transcript, Integer rating, String feedback) {}

    /** Demande d'évaluation au client */
    public record RatingRequestResponse(String sessionId) {}

    /** Agent connecté avec succès */
    public record AgentLoggedInResponse(String agentId, String name) {}

    /** Nouvelle session assignée à l'agent */
    public record NewSessionResponse(String sessionId, String clientName, String subject, List<ChatMessage> messages) {}

    /** Changement de disponibilité confirmé */
    public record AvailabilityChangedResponse(boolean available) {}

    /** Déconnexion d'un participant */
    public record DisconnectedResponse(String sessionId) {}

    /** Erreur serveur */
    public record ErrorResponse(String message) {}
}
