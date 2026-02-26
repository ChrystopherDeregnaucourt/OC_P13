package com.ycyw.chat.listener;

import com.ycyw.chat.service.ChatService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

/**
 * Listener d'événements WebSocket STOMP.
 * <p>
 * Remplace le handler {@code socket.on('disconnect')} du POC Node.js.
 * <p>
 * Intercepte les événements de connexion/déconnexion STOMP
 * et délègue au {@link ChatService} pour la logique métier
 * (libération de slots agent, replacement en file d'attente, etc.).
 */
@Component
public class WebSocketEventListener {

    private static final Logger log = LoggerFactory.getLogger(WebSocketEventListener.class);

    private final ChatService chatService;

    public WebSocketEventListener(ChatService chatService) {
        this.chatService = chatService;
    }

    @EventListener
    public void handleSessionConnect(SessionConnectEvent event) {
        if (event.getUser() != null) {
            log.info("[WebSocket] Nouvelle connexion: {}", event.getUser().getName());
        }
    }

    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        if (event.getUser() != null) {
            String principalName = event.getUser().getName();
            chatService.handleDisconnect(principalName);
        }
    }
}
