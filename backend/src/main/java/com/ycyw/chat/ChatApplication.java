package com.ycyw.chat;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Point d'entrée de l'application POC Chat.
 * <p>
 * Démarre le serveur Spring Boot embarqué (Tomcat)
 * avec le broker STOMP configuré dans {@link com.ycyw.chat.config.WebSocketConfig}.
 */
@SpringBootApplication
public class ChatApplication {

    public static void main(String[] args) {
        SpringApplication.run(ChatApplication.class, args);
    }
}
