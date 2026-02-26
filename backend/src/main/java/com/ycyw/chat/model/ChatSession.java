package com.ycyw.chat.model;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Modèle représentant une session de chat.
 * Correspond à la table {@code chat_sessions} définie dans le schéma de BDD.
 */
public class ChatSession {

    /** Statuts possibles d'une session */
    public static final String STATUS_WAITING = "waiting";
    public static final String STATUS_ACTIVE  = "active";
    public static final String STATUS_ENDED   = "ended";

    private String id;
    private String clientId;        // Principal name du client (STOMP user)
    private String clientName;
    private String clientEmail;
    private String agentId;         // UUID de l'agent assigné
    private String agentName;
    private String agentPrincipal;  // Principal name de l'agent (pour le routage STOMP)
    private String status;          // "waiting", "active", "ended"
    private List<ChatMessage> messages;
    private Instant startedAt;
    private Instant endedAt;
    private Integer rating;
    private String feedback;
    private String subject;

    public ChatSession() {}

    public ChatSession(String clientId, String clientName, String email, String subject) {
        this.id = UUID.randomUUID().toString();
        this.clientId = clientId;
        this.clientName = clientName;
        this.clientEmail = email;
        this.subject = subject;
        this.status = STATUS_WAITING;
        this.messages = new ArrayList<>();
        this.startedAt = Instant.now();
    }

    /**
     * Ajoute un message à la session et le retourne.
     */
    public ChatMessage addMessage(String senderId, String senderType, String content) {
        ChatMessage msg = new ChatMessage(senderId, senderType, content);
        this.messages.add(msg);
        return msg;
    }

    // ── Getters & Setters ──

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }

    public String getClientName() { return clientName; }
    public void setClientName(String clientName) { this.clientName = clientName; }

    public String getClientEmail() { return clientEmail; }
    public void setClientEmail(String clientEmail) { this.clientEmail = clientEmail; }

    public String getAgentId() { return agentId; }
    public void setAgentId(String agentId) { this.agentId = agentId; }

    public String getAgentName() { return agentName; }
    public void setAgentName(String agentName) { this.agentName = agentName; }

    public String getAgentPrincipal() { return agentPrincipal; }
    public void setAgentPrincipal(String agentPrincipal) { this.agentPrincipal = agentPrincipal; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public List<ChatMessage> getMessages() { return messages; }
    public void setMessages(List<ChatMessage> messages) { this.messages = messages; }

    public Instant getStartedAt() { return startedAt; }
    public Instant getEndedAt() { return endedAt; }
    public void setEndedAt(Instant endedAt) { this.endedAt = endedAt; }

    public Integer getRating() { return rating; }
    public void setRating(Integer rating) { this.rating = rating; }

    public String getFeedback() { return feedback; }
    public void setFeedback(String feedback) { this.feedback = feedback; }

    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
}
