package com.ycyw.chat.controller;

import com.ycyw.chat.model.dto.ClientRequests.*;
import com.ycyw.chat.service.ChatService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

/**
 * Contrôleur STOMP gérant les 9 événements client/agent.
 * <p>
 * Chaque méthode correspond à un événement Socket.IO du POC Node.js,
 * mappé vers une destination STOMP {@code /app/...}.
 * <p>
 * Le {@link SimpMessageHeaderAccessor} fournit le {@code Principal}
 * (créé par le ChannelInterceptor dans WebSocketConfig) pour identifier l'utilisateur.
 *
 * <pre>
 * Socket.IO                    → STOMP @MessageMapping
 * ─────────────────────────────────────────────────────
 * client:startChat             → /app/client.startChat
 * client:message               → /app/client.message
 * client:typing                → /app/client.typing
 * client:endChat               → /app/client.endChat
 * agent:login                  → /app/agent.login
 * agent:message                → /app/agent.message
 * agent:typing                 → /app/agent.typing
 * agent:setAvailability        → /app/agent.setAvailability
 * agent:endChat                → /app/agent.endChat
 * </pre>
 */
@Controller
public class ChatController {

    private static final Logger log = LoggerFactory.getLogger(ChatController.class);

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    // ══════════════════════════════════════════════════════════════
    //  Client
    // ══════════════════════════════════════════════════════════════

    @MessageMapping("/client.startChat")
    public void startChat(StartChatRequest request, SimpMessageHeaderAccessor headerAccessor) {
        String principal = headerAccessor.getUser().getName();
        chatService.startChat(principal, request.name(), request.email(), request.subject());
    }

    @MessageMapping("/client.message")
    public void clientMessage(SendMessageRequest request, SimpMessageHeaderAccessor headerAccessor) {
        String principal = headerAccessor.getUser().getName();
        chatService.clientMessage(principal, request.sessionId(), request.content());
    }

    @MessageMapping("/client.typing")
    public void clientTyping(TypingRequest request, SimpMessageHeaderAccessor headerAccessor) {
        String principal = headerAccessor.getUser().getName();
        chatService.clientTyping(principal, request.sessionId(), request.isTyping());
    }

    @MessageMapping("/client.endChat")
    public void clientEndChat(EndChatRequest request, SimpMessageHeaderAccessor headerAccessor) {
        String principal = headerAccessor.getUser().getName();
        chatService.clientEndChat(principal, request.sessionId(), request.rating(), request.feedback());
    }

    // ══════════════════════════════════════════════════════════════
    //  Agent
    // ══════════════════════════════════════════════════════════════

    @MessageMapping("/agent.login")
    public void agentLogin(AgentLoginRequest request, SimpMessageHeaderAccessor headerAccessor) {
        String principal = headerAccessor.getUser().getName();
        chatService.agentLogin(principal, request.name(), request.maxChats());
    }

    @MessageMapping("/agent.message")
    public void agentMessage(SendMessageRequest request, SimpMessageHeaderAccessor headerAccessor) {
        String principal = headerAccessor.getUser().getName();
        chatService.agentMessage(principal, request.sessionId(), request.content());
    }

    @MessageMapping("/agent.typing")
    public void agentTyping(TypingRequest request, SimpMessageHeaderAccessor headerAccessor) {
        String principal = headerAccessor.getUser().getName();
        chatService.agentTyping(principal, request.sessionId(), request.isTyping());
    }

    @MessageMapping("/agent.setAvailability")
    public void setAvailability(AvailabilityRequest request, SimpMessageHeaderAccessor headerAccessor) {
        String principal = headerAccessor.getUser().getName();
        chatService.setAgentAvailability(principal, request.available());
    }

    @MessageMapping("/agent.endChat")
    public void agentEndChat(AgentEndChatRequest request, SimpMessageHeaderAccessor headerAccessor) {
        String principal = headerAccessor.getUser().getName();
        chatService.agentEndChat(principal, request.sessionId());
    }
}
