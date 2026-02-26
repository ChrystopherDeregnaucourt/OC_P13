package com.ycyw.chat.config;

import java.security.Principal;

/**
 * Implémentation de {@link Principal} pour les connexions STOMP.
 * <p>
 * Chaque client WebSocket envoie un UUID dans le header STOMP {@code login}
 * lors du CONNECT. Cet UUID est extrait par le {@link WebSocketConfig} (ChannelInterceptor)
 * et encapsulé dans un {@code StompPrincipal}.
 * <p>
 * Cela permet à {@code SimpMessagingTemplate.convertAndSendToUser(name, dest, payload)}
 * de router les messages vers la bonne connexion WebSocket, sans authentification.
 */
public class StompPrincipal implements Principal {

    private final String name;

    public StompPrincipal(String name) {
        this.name = name;
    }

    @Override
    public String getName() {
        return name;
    }

    @Override
    public String toString() {
        return "StompPrincipal[" + name + "]";
    }
}
