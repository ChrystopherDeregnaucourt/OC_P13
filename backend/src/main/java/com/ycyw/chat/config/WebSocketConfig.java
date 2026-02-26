package com.ycyw.chat.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.util.UUID;

/**
 * Configuration Spring WebSocket + STOMP.
 * <p>
 * Remplace Socket.IO du POC Node.js :
 * <ul>
 *     <li>Endpoint WebSocket : {@code /ws-chat} (avec SockJS fallback)</li>
 *     <li>Préfixe application : {@code /app} (client → serveur)</li>
 *     <li>Broker simple : {@code /queue} (serveur → client, messages user-specific)</li>
 * </ul>
 * <p>
 * Un {@link ChannelInterceptor} extrait l'identifiant utilisateur du header
 * STOMP {@code login} lors du CONNECT et crée un {@link StompPrincipal}.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private static final Logger log = LoggerFactory.getLogger(WebSocketConfig.class);

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // Broker en mémoire pour les destinations /queue (user-specific)
        registry.enableSimpleBroker("/queue");
        // Préfixe pour les @MessageMapping (client → serveur)
        registry.setApplicationDestinationPrefixes("/app");
        // Préfixe pour convertAndSendToUser (résolu en /user/{name}/queue/...)
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Endpoint WebSocket avec SockJS fallback
        registry.addEndpoint("/ws-chat")
                .setAllowedOriginPatterns("*")
                .withSockJS();

        // Endpoint WebSocket natif (sans SockJS, pour les clients STOMP.js purs)
        registry.addEndpoint("/ws-chat")
                .setAllowedOriginPatterns("*");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor =
                        MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

                if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
                    // Extraire l'UUID du header "login" (envoyé par le frontend)
                    String userId = accessor.getLogin();
                    if (userId == null || userId.isBlank()) {
                        // Générer un UUID si le client n'en fournit pas
                        userId = UUID.randomUUID().toString();
                    }
                    log.info("[WebSocket] CONNECT — principal: {}", userId);
                    accessor.setUser(new StompPrincipal(userId));
                }
                return message;
            }
        });
    }
}
