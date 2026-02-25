# POC Chat Support — Your Car Your Way

## Présentation

Ce **Proof of Concept** implémente le module de **chat support en temps réel** de l'application Your Car Your Way, tel que défini dans le *Business Requirements V2* (§4.4.2 — Live Chat Support) et l'*Architecture Definition Document* (§5.3 — Support Context).

Le POC démontre :
- La communication bidirectionnelle en temps réel via **WebSocket** (exigence TECH-007)
- La gestion d'état réactive avec **NgRx** (pattern Redux — §5.3.3)
- L'interface utilisateur **Angular Material** avec le thème de la marque
- Le routage paresseux (*lazy loading*) avec des composants **standalone** (Angular 17)

> **Note :** En production, le backend serait assuré par le **Support Service** (Spring Boot + Spring WebSocket + STOMP) avec persistance PostgreSQL et cache Redis (§5.3.1). Ce POC utilise un serveur Node.js/Express + SockJS avec un broker STOMP simplifié et stockage en mémoire pour démontrer le protocole cible.

---

## Stack technique

| Couche         | Technologie                | Version | Réf. Architecture        |
|----------------|----------------------------|---------|--------------------------|
| Frontend       | Angular (TypeScript)       | 17.3    | §5.3.2                   |
| State Mgmt     | NgRx (Store + Effects)     | 17.2    | §5.3.3 — Pattern Redux   |
| UI Framework   | Angular Material           | 17.3    | §5.3.2                   |
| Communication  | @stomp/stompjs + SockJS    | 7.x     | TECH-007 — STOMP/WS      |
| Serveur (POC)  | Express + SockJS + STOMP   | 5.x     | Simule le Support Service|
| Style          | SCSS                       | —       | Custom Blue Theme        |

---

## Architecture du projet

```
POC_Chat_Angular/
├── server.js                         # Serveur STOMP/SockJS (POC backend)
├── proxy.conf.json                   # Proxy dev Angular → Express
├── angular.json                      # Configuration Angular CLI
├── package.json                      # Dépendances Angular + serveur
├── src/
│   ├── index.html                    # Point d'entrée HTML
│   ├── main.ts                       # Bootstrap Angular
│   ├── styles.scss                   # Thème Angular Material global
│   ├── environments/
│   │   ├── environment.ts            # Config dev (wsBaseUrl)
│   │   └── environment.prod.ts       # Config production
│   └── app/
│       ├── app.component.ts          # Composant racine (router-outlet)
│       ├── app.config.ts             # Providers (NgRx, Router, Animations)
│       ├── app.routes.ts             # Routes lazy-loaded
│       ├── core/
│       │   ├── models/               # Interfaces TypeScript
│       │   │   ├── message.model.ts          # ChatMessage, SenderType
│       │   │   ├── chat-session.model.ts     # ChatSession, SessionStatus
│       │   │   ├── agent.model.ts            # SupportAgent
│       │   │   └── index.ts                  # Barrel export
│       │   └── services/             # Services injectables
│       │       ├── socket.service.ts         # Abstraction STOMP/SockJS
│       │       ├── chat.service.ts           # Logique métier chat
│       │       └── index.ts                  # Barrel export
│       ├── store/
│       │   └── chat/                  # Feature store NgRx
│       │       ├── chat.actions.ts           # Actions (25+)
│       │       ├── chat.reducer.ts           # Reducer + ChatState
│       │       ├── chat.selectors.ts         # Sélecteurs mémoïsés
│       │       ├── chat.effects.ts           # Effets (STOMP ↔ Store)
│       │       └── index.ts                  # Barrel export
│       ├── shared/
│       │   ├── components/
│       │   │   ├── message-bubble/           # Bulle de message
│       │   │   └── typing-indicator/         # Indicateur de saisie
│       │   └── pipes/
│       │       └── relative-time.pipe.ts     # Pipe temps relatif (fr)
│       └── features/
│           ├── client/
│           │   └── client-chat/              # Interface client
│           │       ├── client-chat.component.ts
│           │       ├── client-chat.component.html
│           │       └── client-chat.component.scss
│           └── agent/
│               └── agent-dashboard/          # Tableau de bord agent
│                   ├── agent-dashboard.component.ts
│                   ├── agent-dashboard.component.html
│                   └── agent-dashboard.component.scss
```

---

## Fonctionnalités implémentées

### Interface Client (`/chat`)
- **Formulaire de contact** : nom, email, sujet (avec validation réactive)
- **File d'attente** : position en temps réel, temps d'attente estimé
- **Chat en direct** : envoi/réception de messages instantanés
- **Indicateur de saisie** : affiche quand l'agent est en train de taper
- **Évaluation** : notation par étoiles (1–5) et commentaire facultatif en fin de session
- **Messages système** : notifications de connexion/déconnexion

### Interface Agent (`/agent`)
- **Connexion simple** : nom + nombre de sessions simultanées max
- **Multi-sessions** : gestion de plusieurs clients en parallèle
- **Barre latérale** : liste des sessions avec indicateurs visuels
- **Toggle disponibilité** : se rendre disponible/indisponible
- **Clôture de session** : terminer une conversation avec demande de notation au client

### Architecture & bonnes pratiques
- **Standalone Components** (Angular 17 — pas de NgModule)
- **Lazy Loading** via `loadComponent` dans les routes
- **OnPush Change Detection** sur tous les composants
- **NgRx** : actions, reducer, selectors, effects (séparation of concerns)
- **Barrel exports** (`index.ts`) dans chaque dossier
- **Reactive Forms** avec validateurs synchrones
- **RxJS** : opérateurs, gestion des subscriptions via `takeUntilDestroyed`
- **Typage strict** : interfaces alignées sur le schéma BDD (§5.3.5)

---

## Prérequis

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x
- **Angular CLI** 17.3 (installé localement via `npx`)

---

## Installation

```bash
# 1. Se placer dans le dossier du projet
cd POC_Chat_Angular

# 2. Installer les dépendances Angular
npm install

# 3. Installer les dépendances du serveur
npm install express sockjs uuid
```

---

## Démarrage

### Mode développement (2 terminaux)

**Terminal 1 — Serveur STOMP/SockJS :**
```bash
npm run start:server
# → Serveur STOMP sur http://localhost:3000 (endpoint /ws)
```

**Terminal 2 — Frontend Angular :**
```bash
npm start
# → Angular dev server sur http://localhost:4200
# → Proxy STOMP/SockJS vers localhost:3000
```

### Mode production (serveur unique)
```bash
# Build Angular
npm run build:prod

# Lancer le serveur qui sert le build
npm run start:server
# → Application complète sur http://localhost:3000
```

---

## Utilisation

### 1. Connecter un agent
1. Ouvrir `http://localhost:4200/agent` (dev) ou `http://localhost:3000/agent` (prod)
2. Entrer un nom d'agent et le nombre max de sessions simultanées
3. Cliquer sur **Se connecter**

### 2. Démarrer une conversation client
1. Ouvrir `http://localhost:4200/chat` (dev) ou `http://localhost:3000/chat` (prod)
2. Remplir le formulaire (nom, email, sujet)
3. Cliquer sur **Démarrer le chat**
4. Si un agent est disponible → connexion directe
5. Sinon → mise en file d'attente avec position affichée

### 3. Échanger des messages
- Les messages s'affichent en temps réel des deux côtés
- L'indicateur de saisie apparaît quand l'autre partie tape
- L'auto-scroll suit les nouveaux messages

### 4. Terminer la conversation
- **Côté agent** : cliquer sur « Terminer la conversation » → notification au client
- **Côté client** : donner une note (étoiles) et un commentaire facultatif

---

## Correspondance avec l'Architecture

| Élément POC                     | Équivalent Production (ADD)              |
|---------------------------------|------------------------------------------|
| `server.js` (Express+SockJS+STOMP)| Support Service (Spring Boot + STOMP)    |
| Stockage en mémoire (Map)      | PostgreSQL (chat_sessions, chat_messages)|
| `SocketService`                 | WebSocket STOMP client (identique)       |
| `ChatService`                   | Support API client (STOMP destinations)  |
| NgRx Store                      | NgRx Store (identique)                   |
| Angular Material                | Angular Material (identique)             |
| Pas d'authentification          | Keycloak SSO (AUTH-001 à AUTH-004)        |

---

## Exigences couvertes

| Code     | Exigence                                    | Couvert |
|----------|---------------------------------------------|---------|
| SUP-001  | Live chat en temps réel                     | ✅      |
| SUP-002  | Indicateurs de saisie et de présence        | ✅      |
| SUP-003  | File d'attente avec position                | ✅      |
| SUP-004  | Évaluation de la satisfaction (rating)      | ✅      |
| TECH-007 | WebSocket pour communication temps réel     | ✅      |
| PERF-003 | Latence < 200ms pour les messages           | ✅ (local) |

---

## Licence

Projet interne — Your Car Your Way © 2025
