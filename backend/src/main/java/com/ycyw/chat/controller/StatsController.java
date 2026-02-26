package com.ycyw.chat.controller;

import com.ycyw.chat.service.ChatService;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Contrôleur REST pour les statistiques du chat.
 * <p>
 * Réplique le endpoint {@code GET /api/stats} du POC Node.js.
 */
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class StatsController {

    private final ChatService chatService;

    public StatsController(ChatService chatService) {
        this.chatService = chatService;
    }

    @GetMapping("/stats")
    public Map<String, Object> getStats() {
        return Map.of(
                "activeSessions",  chatService.getActiveSessionsCount(),
                "waitingClients",  chatService.getWaitingClientsCount(),
                "availableAgents", chatService.getAvailableAgentsCount(),
                "totalAgents",     chatService.getTotalAgentsCount()
        );
    }
}
