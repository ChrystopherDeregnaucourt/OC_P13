package com.ycyw.chat.model;

import java.util.UUID;

/**
 * Modèle représentant un agent du support client.
 * Correspond à la table {@code support_agents} définie dans le schéma de BDD.
 */
public class SupportAgent {

    private String id;
    private String principalName;   // STOMP principal (pour le routage)
    private String name;
    private boolean available;
    private int maxChats;
    private int currentChats;

    public SupportAgent() {}

    public SupportAgent(String principalName, String name, int maxChats) {
        this.id = UUID.randomUUID().toString();
        this.principalName = principalName;
        this.name = name;
        this.available = true;
        this.maxChats = maxChats > 0 ? maxChats : 3;
        this.currentChats = 0;
    }

    public boolean canAcceptChat() {
        return available && currentChats < maxChats;
    }

    public void incrementChats() { this.currentChats++; }
    public void decrementChats() { if (this.currentChats > 0) this.currentChats--; }

    // ── Getters & Setters ──

    public String getId() { return id; }
    public String getPrincipalName() { return principalName; }
    public String getName() { return name; }

    public boolean isAvailable() { return available; }
    public void setAvailable(boolean available) { this.available = available; }

    public int getMaxChats() { return maxChats; }
    public int getCurrentChats() { return currentChats; }
}
