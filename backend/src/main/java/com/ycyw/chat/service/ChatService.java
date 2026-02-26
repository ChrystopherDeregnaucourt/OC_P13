package com.ycyw.chat.service;

import com.ycyw.chat.model.ChatMessage;
import com.ycyw.chat.model.ChatSession;
import com.ycyw.chat.model.SupportAgent;
import com.ycyw.chat.model.dto.ServerResponses.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;

/**
 * Service métier principal du chat support.
 * <p>
 * Réplique exacte de la logique de {@code server.js} (POC Node.js/Socket.IO),
 * portée en Java avec des structures thread-safe.
 * <p>
 * Structures en mémoire (en production → Redis / BDD) :
 * <ul>
 *     <li>{@code chatSessions}   — Map sessionId → ChatSession</li>
 *     <li>{@code waitingQueue}   — Deque ordonnée des clients en attente</li>
 *     <li>{@code supportAgents}  — Map principalName → SupportAgent</li>
 *     <li>{@code clientSessions} — Map principalName → sessionId</li>
 * </ul>
 */
@Service
public class ChatService {

    private static final Logger log = LoggerFactory.getLogger(ChatService.class);

    private final SimpMessagingTemplate messaging;

    /** sessionId → ChatSession */
    private final Map<String, ChatSession> chatSessions = new ConcurrentHashMap<>();

    /** File d'attente FIFO (clients en attente d'un agent) */
    private final Deque<QueueEntry> waitingQueue = new ConcurrentLinkedDeque<>();

    /** principalName → SupportAgent */
    private final Map<String, SupportAgent> supportAgents = new ConcurrentHashMap<>();

    /** principalName (client) → sessionId */
    private final Map<String, String> clientSessions = new ConcurrentHashMap<>();

    // ── Entrée de la file d'attente ──

    private record QueueEntry(String principalName, String sessionId, String name, Instant joinedAt) {}

    // ══════════════════════════════════════════════════════════════
    //  Constructeur
    // ══════════════════════════════════════════════════════════════

    public ChatService(SimpMessagingTemplate messaging) {
        this.messaging = messaging;
    }

    // ══════════════════════════════════════════════════════════════
    //  Actions Client
    // ══════════════════════════════════════════════════════════════

    /**
     * Démarre un chat : crée la session, cherche un agent disponible
     * ou place le client en file d'attente.
     */
    public void startChat(String principalName, String name, String email, String subject) {
        log.info("[Chat] Client \"{}\" démarre un chat (sujet: {})", name, subject);

        ChatSession session = new ChatSession(principalName, name, email, subject);
        chatSessions.put(session.getId(), session);
        clientSessions.put(principalName, session.getId());

        // Message système de bienvenue
        session.addMessage("system", "system",
                "Bonjour " + name + ", bienvenue sur le support Your Car Your Way. Un conseiller va vous répondre sous peu.");

        SupportAgent agent = findAvailableAgent();

        if (agent != null) {
            // ── Agent disponible → démarrage immédiat ──
            session.setAgentId(agent.getId());
            session.setAgentName(agent.getName());
            session.setAgentPrincipal(agent.getPrincipalName());
            session.setStatus(ChatSession.STATUS_ACTIVE);
            agent.incrementChats();

            // Notifier le client
            messaging.convertAndSendToUser(principalName, "/queue/chat.started",
                    new ChatStartedResponse(session.getId(), agent.getName(), session.getMessages()));

            // Notifier l'agent
            messaging.convertAndSendToUser(agent.getPrincipalName(), "/queue/chat.newSession",
                    new NewSessionResponse(session.getId(), name, subject, session.getMessages()));

            // Message système « agent a rejoint »
            ChatMessage systemMsg = session.addMessage("system", "system",
                    agent.getName() + " a rejoint la conversation.");
            messaging.convertAndSendToUser(principalName, "/queue/chat.message", systemMsg);
            messaging.convertAndSendToUser(agent.getPrincipalName(), "/queue/chat.message",
                    systemMsg.withSessionId(session.getId()));

        } else {
            // ── Pas d'agent → file d'attente ──
            waitingQueue.addLast(new QueueEntry(principalName, session.getId(), name, Instant.now()));

            int position = waitingQueue.size();
            messaging.convertAndSendToUser(principalName, "/queue/chat.queued",
                    new ChatQueuedResponse(session.getId(), position, position * 2, session.getMessages()));
        }
    }

    /**
     * Message envoyé par un client.
     */
    public void clientMessage(String principalName, String sessionId, String content) {
        ChatSession session = chatSessions.get(sessionId);
        if (session == null) {
            sendError(principalName, "Session non trouvée");
            return;
        }

        ChatMessage message = session.addMessage(principalName, "client", content);

        // Echo au client
        messaging.convertAndSendToUser(principalName, "/queue/chat.message", message);

        // Relayer à l'agent
        if (session.getAgentPrincipal() != null) {
            messaging.convertAndSendToUser(session.getAgentPrincipal(), "/queue/chat.message",
                    message.withSessionId(sessionId));
        }
    }

    /**
     * Indicateur de saisie client → agent.
     */
    public void clientTyping(String principalName, String sessionId, boolean isTyping) {
        ChatSession session = chatSessions.get(sessionId);
        if (session != null && session.getAgentPrincipal() != null) {
            messaging.convertAndSendToUser(session.getAgentPrincipal(), "/queue/chat.typing",
                    new TypingResponse(sessionId, isTyping, "client"));
        }
    }

    /**
     * Le client termine le chat (avec évaluation).
     */
    public void clientEndChat(String principalName, String sessionId, int rating, String feedback) {
        ChatSession session = chatSessions.get(sessionId);
        if (session == null) return;

        session.setStatus(ChatSession.STATUS_ENDED);
        session.setEndedAt(Instant.now());
        session.setRating(rating);
        session.setFeedback(feedback);
        session.addMessage("system", "system", "Le client a terminé la conversation.");

        if (session.getAgentPrincipal() != null) {
            // Notifier l'agent
            messaging.convertAndSendToUser(session.getAgentPrincipal(), "/queue/chat.ended",
                    new ChatEndedResponse(sessionId, null, rating, feedback));

            // Libérer le slot agent
            SupportAgent agent = supportAgents.get(session.getAgentPrincipal());
            if (agent != null) {
                agent.decrementChats();
                assignFromQueue(agent);
            }
        }

        // Notifier le client (avec transcript)
        messaging.convertAndSendToUser(principalName, "/queue/chat.ended",
                new ChatEndedResponse(sessionId, session.getMessages(), null, null));
    }

    // ══════════════════════════════════════════════════════════════
    //  Actions Agent
    // ══════════════════════════════════════════════════════════════

    /**
     * Connexion d'un agent.
     */
    public void agentLogin(String principalName, String name, int maxChats) {
        log.info("[Agent] \"{}\" connecté (max {} chats)", name, maxChats);

        SupportAgent agent = new SupportAgent(principalName, name, maxChats);
        supportAgents.put(principalName, agent);

        messaging.convertAndSendToUser(principalName, "/queue/agent.loggedIn",
                new AgentLoggedInResponse(agent.getId(), agent.getName()));

        // Essayer d'assigner un client en attente
        assignFromQueue(agent);
    }

    /**
     * Message envoyé par un agent.
     */
    public void agentMessage(String principalName, String sessionId, String content) {
        ChatSession session = chatSessions.get(sessionId);
        SupportAgent agent = supportAgents.get(principalName);

        if (session == null || agent == null) {
            sendError(principalName, "Session ou agent non trouvé");
            return;
        }

        ChatMessage message = session.addMessage(agent.getId(), "agent", content);

        // Echo à l'agent (avec sessionId pour le multi-sessions)
        messaging.convertAndSendToUser(principalName, "/queue/chat.message",
                message.withSessionId(sessionId));

        // Relayer au client
        if (session.getClientId() != null) {
            messaging.convertAndSendToUser(session.getClientId(), "/queue/chat.message", message);
        }
    }

    /**
     * Indicateur de saisie agent → client.
     */
    public void agentTyping(String principalName, String sessionId, boolean isTyping) {
        ChatSession session = chatSessions.get(sessionId);
        if (session != null && session.getClientId() != null) {
            messaging.convertAndSendToUser(session.getClientId(), "/queue/chat.typing",
                    new TypingResponse(sessionId, isTyping, "agent"));
        }
    }

    /**
     * Change la disponibilité de l'agent.
     */
    public void setAgentAvailability(String principalName, boolean available) {
        SupportAgent agent = supportAgents.get(principalName);
        if (agent != null) {
            agent.setAvailable(available);
            if (available) {
                assignFromQueue(agent);
            }
            messaging.convertAndSendToUser(principalName, "/queue/agent.availabilityChanged",
                    new AvailabilityChangedResponse(available));
        }
    }

    /**
     * L'agent termine un chat (demande d'évaluation au client).
     */
    public void agentEndChat(String principalName, String sessionId) {
        ChatSession session = chatSessions.get(sessionId);
        SupportAgent agent = supportAgents.get(principalName);

        if (session == null || agent == null) return;

        session.setStatus(ChatSession.STATUS_ENDED);
        session.setEndedAt(Instant.now());
        agent.decrementChats();

        // Message système de fin
        ChatMessage systemMsg = session.addMessage("system", "system",
                "Le conseiller a terminé la conversation. Merci de votre confiance !");

        // Notifier le client
        if (session.getClientId() != null) {
            messaging.convertAndSendToUser(session.getClientId(), "/queue/chat.message", systemMsg);
            messaging.convertAndSendToUser(session.getClientId(), "/queue/chat.requestRating",
                    new RatingRequestResponse(sessionId));
        }

        // Notifier l'agent
        messaging.convertAndSendToUser(principalName, "/queue/chat.ended",
                new ChatEndedResponse(sessionId, null, null, null));

        // Assigner le prochain client en attente
        assignFromQueue(agent);
    }

    // ══════════════════════════════════════════════════════════════
    //  Gestion des déconnexions
    // ══════════════════════════════════════════════════════════════

    /**
     * Gère la déconnexion d'un utilisateur (client ou agent).
     */
    public void handleDisconnect(String principalName) {
        log.info("[Socket] Déconnexion: {}", principalName);

        // ── Déconnexion Client ──
        String sessionId = clientSessions.get(principalName);
        if (sessionId != null) {
            ChatSession session = chatSessions.get(sessionId);
            if (session != null && !ChatSession.STATUS_ENDED.equals(session.getStatus())) {
                session.setStatus(ChatSession.STATUS_ENDED);
                session.setEndedAt(Instant.now());

                if (session.getAgentPrincipal() != null) {
                    messaging.convertAndSendToUser(session.getAgentPrincipal(),
                            "/queue/chat.clientDisconnected",
                            new DisconnectedResponse(session.getId()));

                    SupportAgent agent = supportAgents.get(session.getAgentPrincipal());
                    if (agent != null) {
                        agent.decrementChats();
                        assignFromQueue(agent);
                    }
                }
            }

            // Retirer de la file d'attente si présent
            waitingQueue.removeIf(e -> e.principalName().equals(principalName));
            updateQueuePositions();

            clientSessions.remove(principalName);
        }

        // ── Déconnexion Agent ──
        SupportAgent agent = supportAgents.get(principalName);
        if (agent != null) {
            // Replacer toutes les sessions actives de cet agent en file d'attente
            for (Map.Entry<String, ChatSession> entry : chatSessions.entrySet()) {
                ChatSession session = entry.getValue();
                if (agent.getId().equals(session.getAgentId())
                        && ChatSession.STATUS_ACTIVE.equals(session.getStatus())) {

                    session.setStatus(ChatSession.STATUS_WAITING);
                    session.setAgentId(null);
                    session.setAgentName(null);
                    session.setAgentPrincipal(null);

                    String clientPrincipal = session.getClientId();
                    if (clientPrincipal != null) {
                        ChatMessage systemMsg = session.addMessage("system", "system",
                                "Votre conseiller a été déconnecté. Vous allez être transféré à un autre conseiller.");
                        messaging.convertAndSendToUser(clientPrincipal, "/queue/chat.message", systemMsg);
                        messaging.convertAndSendToUser(clientPrincipal, "/queue/chat.agentDisconnected",
                                new DisconnectedResponse(entry.getKey()));

                        // Replacer en TÊTE de file (priorité)
                        waitingQueue.addFirst(new QueueEntry(
                                clientPrincipal, entry.getKey(), session.getClientName(), Instant.now()));
                    }
                }
            }
            updateQueuePositions();
            supportAgents.remove(principalName);
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  Stats (REST)
    // ══════════════════════════════════════════════════════════════

    public long getActiveSessionsCount() {
        return chatSessions.values().stream()
                .filter(s -> ChatSession.STATUS_ACTIVE.equals(s.getStatus())).count();
    }

    public int getWaitingClientsCount() {
        return waitingQueue.size();
    }

    public long getAvailableAgentsCount() {
        return supportAgents.values().stream().filter(SupportAgent::canAcceptChat).count();
    }

    public int getTotalAgentsCount() {
        return supportAgents.size();
    }

    // ══════════════════════════════════════════════════════════════
    //  Fonctions internes
    // ══════════════════════════════════════════════════════════════

    /**
     * Cherche le premier agent disponible.
     */
    private SupportAgent findAvailableAgent() {
        for (SupportAgent agent : supportAgents.values()) {
            if (agent.canAcceptChat()) {
                return agent;
            }
        }
        return null;
    }

    /**
     * Assigne le prochain client en attente à un agent.
     */
    private void assignFromQueue(SupportAgent agent) {
        if (waitingQueue.isEmpty() || !agent.canAcceptChat()) return;

        QueueEntry clientData = waitingQueue.pollFirst();
        if (clientData == null) return;

        ChatSession session = chatSessions.get(clientData.sessionId());
        if (session == null) return;

        session.setAgentId(agent.getId());
        session.setAgentName(agent.getName());
        session.setAgentPrincipal(agent.getPrincipalName());
        session.setStatus(ChatSession.STATUS_ACTIVE);
        agent.incrementChats();

        // Notifier le client
        messaging.convertAndSendToUser(clientData.principalName(), "/queue/chat.assigned",
                new ChatAssignedResponse(session.getId(), agent.getName()));

        // Notifier l'agent
        messaging.convertAndSendToUser(agent.getPrincipalName(), "/queue/chat.newSession",
                new NewSessionResponse(session.getId(), session.getClientName(), session.getSubject(), session.getMessages()));

        // Message système
        ChatMessage systemMsg = session.addMessage("system", "system",
                agent.getName() + " a rejoint la conversation.");
        messaging.convertAndSendToUser(clientData.principalName(), "/queue/chat.message", systemMsg);
        messaging.convertAndSendToUser(agent.getPrincipalName(), "/queue/chat.message",
                systemMsg.withSessionId(session.getId()));

        updateQueuePositions();
    }

    /**
     * Met à jour les positions de tous les clients en file d'attente.
     */
    private void updateQueuePositions() {
        int position = 1;
        for (QueueEntry entry : waitingQueue) {
            messaging.convertAndSendToUser(entry.principalName(), "/queue/chat.queuePosition",
                    new QueuePositionResponse(position, position * 2));
            position++;
        }
    }

    /**
     * Envoie une erreur à un utilisateur.
     */
    private void sendError(String principalName, String message) {
        messaging.convertAndSendToUser(principalName, "/queue/errors",
                new ErrorResponse(message));
    }
}
