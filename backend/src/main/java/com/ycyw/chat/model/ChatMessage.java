package com.ycyw.chat.model;

import java.time.Instant;
import java.util.UUID;

/**
 * Modèle représentant un message dans une session de chat.
 * Correspond à la table {@code chat_messages} définie dans le schéma de BDD.
 */
public class ChatMessage {

    private String id;
    private String senderId;
    private String senderType;   // "client", "agent", "system"
    private String content;
    private Instant timestamp;
    private String sessionId;    // Utilisé côté agent pour le routage multi-sessions

    public ChatMessage() {}

    public ChatMessage(String senderId, String senderType, String content) {
        this.id = UUID.randomUUID().toString();
        this.senderId = senderId;
        this.senderType = senderType;
        this.content = content;
        this.timestamp = Instant.now();
    }

    // ── Getters & Setters ──

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getSenderId() { return senderId; }
    public void setSenderId(String senderId) { this.senderId = senderId; }

    public String getSenderType() { return senderType; }
    public void setSenderType(String senderType) { this.senderType = senderType; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }

    /**
     * Crée une copie du message enrichie avec le sessionId (pour l'agent multi-sessions).
     */
    public ChatMessage withSessionId(String sessionId) {
        ChatMessage copy = new ChatMessage();
        copy.id = this.id;
        copy.senderId = this.senderId;
        copy.senderType = this.senderType;
        copy.content = this.content;
        copy.timestamp = this.timestamp;
        copy.sessionId = sessionId;
        return copy;
    }
}
