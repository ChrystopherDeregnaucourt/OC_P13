/**
 * POC Chat - Your Car Your Way
 * Serveur de chat en temps réel avec STOMP over SockJS
 *
 * Ce serveur constitue le backend du POC de chat support.
 * Il implémente un broker STOMP simplifié sur transport SockJS,
 * conformément à l'exigence TECH-007 (communication temps réel).
 *
 * En production, ce rôle serait assuré par le Support Service
 * (Spring Boot + Spring WebSocket + STOMP) défini dans l'architecture.
 *
 * Le protocole STOMP utilisé est compatible avec les clients
 * @stomp/stompjs + SockJS, identiques à ceux utilisés avec Spring.
 *
 * Destinations STOMP :
 *   /app/...         → Messages envoyés par le client (@MessageMapping)
 *   /user/queue/...  → Messages reçus par le client (SimpMessagingTemplate)
 *
 * Usage :
 *   node server.js
 *
 * Le serveur écoute sur le port 3000 (ou PORT env).
 * Frontend Angular servi depuis le dossier dist/ (après build).
 */

const express = require('express');
const http = require('http');
const sockjs = require('sockjs');
const crypto = require('crypto');
const path = require('path');

/** Génère un UUID v4 via l'API native Node.js (≥ 18) */
const uuidv4 = () => crypto.randomUUID();

// Configuration
const PORT = process.env.PORT || 3000;

// ==================== STOMP FRAME UTILITIES ====================

/**
 * Parse un ou plusieurs frames STOMP depuis les données brutes.
 * Le protocole STOMP utilise \0 comme délimiteur de frame.
 */
function parseStompFrames(data) {
  const frames = [];
  const rawFrames = data.split('\0').filter(f => f.trim().length > 0);

  for (const raw of rawFrames) {
    const lines = raw.split('\n');
    let startIdx = 0;
    // Skip leading empty lines (heartbeats)
    while (startIdx < lines.length && lines[startIdx].trim() === '') startIdx++;
    if (startIdx >= lines.length) continue;

    const command = lines[startIdx].trim();
    const headers = {};
    let i = startIdx + 1;

    while (i < lines.length) {
      const line = lines[i];
      if (line === '' || line === '\r') break;
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        headers[line.substring(0, colonIdx)] = line.substring(colonIdx + 1).replace('\r', '');
      }
      i++;
    }
    i++; // skip blank line separator

    const body = lines.slice(i).join('\n');
    frames.push({ command, headers, body });
  }

  return frames;
}

/**
 * Construit un frame STOMP sous forme de chaîne.
 */
function buildStompFrame(command, headers = {}, body = '') {
  let frame = command + '\n';
  for (const [key, value] of Object.entries(headers)) {
    frame += `${key}:${value}\n`;
  }
  frame += '\n' + body + '\0';
  return frame;
}

// ==================== INITIALISATION SERVEUR ====================

const app = express();
const server = http.createServer(app);

// Servir le build Angular (en production)
app.use(express.static(path.join(__dirname, 'dist', 'poc-chat-angular', 'browser')));

// Créer le serveur SockJS (endpoint /ws, comme Spring WebSocket)
const wsServer = sockjs.createServer({
  log: (severity, message) => {
    if (severity === 'error') console.error('[SockJS]', message);
  }
});

// ==================== STOCKAGE EN MÉMOIRE ====================
// En production : PostgreSQL (chat_sessions, chat_messages) + Redis (cache/pub-sub)

const chatSessions = new Map();
const waitingQueue = [];
const supportAgents = new Map();      // connId → agent data
const clientConnections = new Map();  // connId → client data
const stompConnections = new Map();   // connId → { conn, subscriptions: Map<subId, destination> }

// ==================== FONCTIONS MÉTIER ====================

function createSession(connId, clientName) {
  return {
    id: uuidv4(),
    clientId: connId,
    clientName,
    agentId: null,
    agentName: null,
    status: 'waiting',
    messages: [],
    startedAt: new Date(),
    endedAt: null,
    rating: null,
    feedback: null
  };
}

function addMessage(session, senderId, senderType, content) {
  const message = {
    id: uuidv4(),
    senderId,
    senderType,
    content,
    timestamp: new Date()
  };
  session.messages.push(message);
  return message;
}

function findAvailableAgent() {
  for (const [connId, agent] of supportAgents) {
    if (agent.available && agent.currentChats < agent.maxChats) {
      return { connId, agent };
    }
  }
  return null;
}

/**
 * Envoie un message STOMP à une connexion spécifique.
 * Trouve la souscription correspondant à la destination cible.
 * Simule le comportement de SimpMessagingTemplate.convertAndSendToUser().
 */
function sendToConnection(connId, destination, body) {
  const connData = stompConnections.get(connId);
  if (!connData) return;

  for (const [subId, subDest] of connData.subscriptions) {
    if (subDest === destination) {
      const frame = buildStompFrame('MESSAGE', {
        'subscription': subId,
        'message-id': uuidv4(),
        'destination': destination,
        'content-type': 'application/json'
      }, typeof body === 'string' ? body : JSON.stringify(body));
      try {
        connData.conn.write(frame);
      } catch (e) {
        console.error(`[STOMP] Erreur envoi vers ${connId}:`, e.message);
      }
      return;
    }
  }
}

function assignFromQueue(agentConnId, agent) {
  if (waitingQueue.length === 0) return;

  const clientData = waitingQueue.shift();
  const session = chatSessions.get(clientData.sessionId);

  if (session) {
    session.agentId = agent.id;
    session.agentName = agent.name;
    session.status = 'active';
    agent.currentChats++;

    sendToConnection(clientData.connId, '/user/queue/chat.assigned', {
      sessionId: session.id,
      agentName: agent.name
    });

    sendToConnection(agentConnId, '/user/queue/chat.newSession', {
      sessionId: session.id,
      clientName: session.clientName,
      messages: session.messages
    });

    const systemMsg = addMessage(session, 'system', 'system',
      `${agent.name} a rejoint la conversation.`);
    sendToConnection(clientData.connId, '/user/queue/chat.message', systemMsg);
    sendToConnection(agentConnId, '/user/queue/chat.message', { ...systemMsg, sessionId: session.id });

    updateQueuePositions();
  }
}

function updateQueuePositions() {
  waitingQueue.forEach((client, index) => {
    sendToConnection(client.connId, '/user/queue/chat.queuePosition', {
      position: index + 1,
      estimatedWait: (index + 1) * 2
    });
  });
}

function findAgentConnById(agentId) {
  for (const [connId, agent] of supportAgents) {
    if (agent.id === agentId) return connId;
  }
  return null;
}

function findClientConnBySession(sessionId) {
  for (const [connId, data] of clientConnections) {
    if (data.sessionId === sessionId) return connId;
  }
  return null;
}

// ==================== GESTIONNAIRE STOMP ====================

/**
 * Traite les frames STOMP reçues d'une connexion.
 * Implémente les commandes CONNECT, SUBSCRIBE, UNSUBSCRIBE, SEND, DISCONNECT.
 */
function handleStompFrame(connId, frame) {
  const connData = stompConnections.get(connId);
  if (!connData) return;

  switch (frame.command) {
    case 'CONNECT':
    case 'STOMP': {
      // Répondre avec CONNECTED (handshake STOMP)
      const connectedFrame = buildStompFrame('CONNECTED', {
        'version': '1.2',
        'heart-beat': '0,0',
        'server': 'ycyw-poc-stomp/1.0'
      });
      connData.conn.write(connectedFrame);
      console.log(`[STOMP] Connexion STOMP établie: ${connId}`);
      break;
    }

    case 'SUBSCRIBE': {
      const subId = frame.headers['id'];
      const destination = frame.headers['destination'];
      if (subId && destination) {
        connData.subscriptions.set(subId, destination);
        console.log(`[STOMP] ${connId} abonné à ${destination} (sub: ${subId})`);
      }
      break;
    }

    case 'UNSUBSCRIBE': {
      const subId = frame.headers['id'];
      if (subId) {
        connData.subscriptions.delete(subId);
      }
      break;
    }

    case 'SEND': {
      const destination = frame.headers['destination'];
      let body = {};
      try {
        body = frame.body ? JSON.parse(frame.body) : {};
      } catch (e) {
        console.error('[STOMP] JSON invalide:', frame.body);
        return;
      }
      handleSendMessage(connId, destination, body);
      break;
    }

    case 'DISCONNECT': {
      if (frame.headers['receipt']) {
        const receiptFrame = buildStompFrame('RECEIPT', {
          'receipt-id': frame.headers['receipt']
        });
        connData.conn.write(receiptFrame);
      }
      break;
    }
  }
}

// ==================== ROUTAGE DES MESSAGES STOMP ====================

/**
 * Route les messages SEND vers les handlers métier appropriés.
 * Simule le @MessageMapping de Spring WebSocket.
 */
function handleSendMessage(connId, destination, body) {
  switch (destination) {
    // ── Client ──
    case '/app/chat.start':
      handleChatStart(connId, body);
      break;
    case '/app/chat.clientMessage':
      handleClientMessage(connId, body);
      break;
    case '/app/chat.clientTyping':
      handleClientTyping(connId, body);
      break;
    case '/app/chat.clientEnd':
      handleClientEnd(connId, body);
      break;

    // ── Agent ──
    case '/app/agent.login':
      handleAgentLogin(connId, body);
      break;
    case '/app/agent.message':
      handleAgentMessage(connId, body);
      break;
    case '/app/agent.typing':
      handleAgentTyping(connId, body);
      break;
    case '/app/agent.setAvailability':
      handleAgentSetAvailability(connId, body);
      break;
    case '/app/agent.endChat':
      handleAgentEndChat(connId, body);
      break;

    default:
      console.warn(`[STOMP] Destination inconnue: ${destination}`);
  }
}

// ==================== HANDLERS MÉTIER ====================

function handleChatStart(connId, data) {
  const { name, email, subject } = data;
  console.log(`[Chat] Client "${name}" démarre un chat (sujet: ${subject})`);

  const session = createSession(connId, name);
  chatSessions.set(session.id, session);
  clientConnections.set(connId, { sessionId: session.id, name, email });

  addMessage(session, 'system', 'system',
    `Bonjour ${name}, bienvenue sur le support Your Car Your Way. Un conseiller va vous répondre sous peu.`);

  const availableAgent = findAvailableAgent();

  if (availableAgent) {
    session.agentId = availableAgent.agent.id;
    session.agentName = availableAgent.agent.name;
    session.status = 'active';
    availableAgent.agent.currentChats++;

    sendToConnection(connId, '/user/queue/chat.started', {
      sessionId: session.id,
      agentName: availableAgent.agent.name,
      messages: session.messages
    });

    sendToConnection(availableAgent.connId, '/user/queue/chat.newSession', {
      sessionId: session.id,
      clientName: name,
      subject,
      messages: session.messages
    });

    const systemMsg = addMessage(session, 'system', 'system',
      `${availableAgent.agent.name} a rejoint la conversation.`);
    sendToConnection(connId, '/user/queue/chat.message', systemMsg);
    sendToConnection(availableAgent.connId, '/user/queue/chat.message', { ...systemMsg, sessionId: session.id });
  } else {
    waitingQueue.push({
      connId,
      sessionId: session.id,
      name,
      joinedAt: new Date()
    });

    sendToConnection(connId, '/user/queue/chat.queued', {
      sessionId: session.id,
      position: waitingQueue.length,
      estimatedWait: waitingQueue.length * 2,
      messages: session.messages
    });
  }
}

function handleClientMessage(connId, data) {
  const { sessionId, content } = data;
  const session = chatSessions.get(sessionId);

  if (!session) {
    sendToConnection(connId, '/user/queue/errors', { message: 'Session non trouvée' });
    return;
  }

  const message = addMessage(session, connId, 'client', content);
  sendToConnection(connId, '/user/queue/chat.message', message);

  if (session.agentId) {
    const agentConnId = findAgentConnById(session.agentId);
    if (agentConnId) {
      sendToConnection(agentConnId, '/user/queue/chat.message', { ...message, sessionId });
    }
  }
}

function handleClientTyping(connId, data) {
  const { sessionId, isTyping } = data;
  const session = chatSessions.get(sessionId);

  if (session && session.agentId) {
    const agentConnId = findAgentConnById(session.agentId);
    if (agentConnId) {
      sendToConnection(agentConnId, '/user/queue/chat.typing', { sessionId, isTyping, from: 'client' });
    }
  }
}

function handleClientEnd(connId, data) {
  const { sessionId, rating, feedback } = data;
  const session = chatSessions.get(sessionId);

  if (session) {
    session.status = 'ended';
    session.endedAt = new Date();
    session.rating = rating;
    session.feedback = feedback;

    addMessage(session, 'system', 'system', 'Le client a terminé la conversation.');

    if (session.agentId) {
      const agentConnId = findAgentConnById(session.agentId);
      if (agentConnId) {
        sendToConnection(agentConnId, '/user/queue/chat.ended', { sessionId, rating, feedback });
        const agent = supportAgents.get(agentConnId);
        if (agent) {
          agent.currentChats--;
          assignFromQueue(agentConnId, agent);
        }
      }
    }

    sendToConnection(connId, '/user/queue/chat.ended', { sessionId, transcript: session.messages });
  }
}

function handleAgentLogin(connId, data) {
  const { name, maxChats = 3 } = data;
  console.log(`[Agent] "${name}" connecté (max ${maxChats} chats)`);

  const agent = {
    id: uuidv4(),
    name,
    available: true,
    maxChats,
    currentChats: 0
  };

  supportAgents.set(connId, agent);
  sendToConnection(connId, '/user/queue/agent.loggedIn', { agentId: agent.id, name: agent.name });

  assignFromQueue(connId, agent);
}

function handleAgentMessage(connId, data) {
  const { sessionId, content } = data;
  const session = chatSessions.get(sessionId);
  const agent = supportAgents.get(connId);

  if (!session || !agent) {
    sendToConnection(connId, '/user/queue/errors', { message: 'Session ou agent non trouvé' });
    return;
  }

  const message = addMessage(session, agent.id, 'agent', content);
  sendToConnection(connId, '/user/queue/chat.message', { ...message, sessionId });

  const clientConnId = findClientConnBySession(sessionId);
  if (clientConnId) {
    sendToConnection(clientConnId, '/user/queue/chat.message', message);
  }
}

function handleAgentTyping(connId, data) {
  const { sessionId, isTyping } = data;
  const clientConnId = findClientConnBySession(sessionId);
  if (clientConnId) {
    sendToConnection(clientConnId, '/user/queue/chat.typing', { sessionId, isTyping, from: 'agent' });
  }
}

function handleAgentSetAvailability(connId, data) {
  const { available } = data;
  const agent = supportAgents.get(connId);
  if (agent) {
    agent.available = available;
    if (available) assignFromQueue(connId, agent);
    sendToConnection(connId, '/user/queue/agent.availabilityChanged', { available });
  }
}

function handleAgentEndChat(connId, data) {
  const { sessionId } = data;
  const session = chatSessions.get(sessionId);
  const agent = supportAgents.get(connId);

  if (session && agent) {
    session.status = 'ended';
    session.endedAt = new Date();
    agent.currentChats--;

    const systemMsg = addMessage(session, 'system', 'system',
      'Le conseiller a terminé la conversation. Merci de votre confiance !');

    const clientConnId = findClientConnBySession(sessionId);
    if (clientConnId) {
      sendToConnection(clientConnId, '/user/queue/chat.message', systemMsg);
      sendToConnection(clientConnId, '/user/queue/chat.requestRating', { sessionId });
    }

    sendToConnection(connId, '/user/queue/chat.ended', { sessionId });
    assignFromQueue(connId, agent);
  }
}

// ==================== GESTION DES DÉCONNEXIONS ====================

function handleDisconnect(connId) {
  console.log(`[STOMP] Déconnexion: ${connId}`);

  // Déconnexion client
  const clientData = clientConnections.get(connId);
  if (clientData) {
    const session = chatSessions.get(clientData.sessionId);
    if (session && session.status !== 'ended') {
      session.status = 'ended';
      session.endedAt = new Date();

      if (session.agentId) {
        const agentConnId = findAgentConnById(session.agentId);
        if (agentConnId) {
          sendToConnection(agentConnId, '/user/queue/chat.clientDisconnected', { sessionId: session.id });
          const agent = supportAgents.get(agentConnId);
          if (agent) {
            agent.currentChats--;
            assignFromQueue(agentConnId, agent);
          }
        }
      }
    }

    const queueIndex = waitingQueue.findIndex((c) => c.connId === connId);
    if (queueIndex !== -1) {
      waitingQueue.splice(queueIndex, 1);
      updateQueuePositions();
    }

    clientConnections.delete(connId);
  }

  // Déconnexion agent
  const agent = supportAgents.get(connId);
  if (agent) {
    for (const [sessionId, session] of chatSessions) {
      if (session.agentId === agent.id && session.status === 'active') {
        session.status = 'waiting';
        session.agentId = null;
        session.agentName = null;

        const clientConnId = findClientConnBySession(sessionId);
        if (clientConnId) {
          const systemMsg = addMessage(session, 'system', 'system',
            'Votre conseiller a été déconnecté. Vous allez être transféré à un autre conseiller.');
          sendToConnection(clientConnId, '/user/queue/chat.message', systemMsg);
          sendToConnection(clientConnId, '/user/queue/chat.agentDisconnected', { sessionId });

          waitingQueue.unshift({
            connId: clientConnId,
            sessionId,
            name: session.clientName,
            joinedAt: new Date()
          });
          updateQueuePositions();
        }
      }
    }
    supportAgents.delete(connId);
  }

  stompConnections.delete(connId);
}

// ==================== CONNEXION SOCKJS ====================

wsServer.on('connection', (conn) => {
  console.log(`[SockJS] Nouvelle connexion: ${conn.id}`);

  stompConnections.set(conn.id, {
    conn,
    subscriptions: new Map()
  });

  conn.on('data', (rawData) => {
    const frames = parseStompFrames(rawData);
    for (const frame of frames) {
      handleStompFrame(conn.id, frame);
    }
  });

  conn.on('close', () => {
    handleDisconnect(conn.id);
  });
});

wsServer.installHandlers(server, { prefix: '/ws' });

// ==================== ROUTES HTTP ====================

// API stats
app.get('/api/stats', (req, res) => {
  res.json({
    activeSessions: [...chatSessions.values()].filter((s) => s.status === 'active').length,
    waitingClients: waitingQueue.length,
    availableAgents: [...supportAgents.values()].filter((a) => a.available && a.currentChats < a.maxChats).length,
    totalAgents: supportAgents.size
  });
});

// SPA fallback : toutes les routes non-API renvoient vers l'index Angular
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'poc-chat-angular', 'browser', 'index.html'));
});

// ==================== DÉMARRAGE DU SERVEUR ====================

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║       YOUR CAR YOUR WAY - POC Chat Support (Angular)           ║
║                                                                ║
║       Serveur démarré sur http://localhost:${PORT}                ║
║       WebSocket STOMP endpoint: /ws (SockJS)                   ║
║                                                                ║
║       Interface Client: http://localhost:${PORT}/chat             ║
║       Interface Agent:  http://localhost:${PORT}/agent            ║
║       API Stats:        http://localhost:${PORT}/api/stats        ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
  `);
});
