# Your Car Your Way — POC Chat en direct

> **Projet 13 — OpenClassrooms**
>
> Proof of Concept d'un système de chat en temps réel entre des **clients** et des **agents de support**, construit avec **Spring Boot** (backend) et **Angular 17** (frontend), communiquant via **WebSocket STOMP**.

---

## Table des matières

1. [Présentation](#présentation)
2. [Fonctionnalités](#fonctionnalités)
3. [Architecture technique](#architecture-technique)
4. [Prérequis](#prérequis)
5. [Installation et lancement](#installation-et-lancement)
6. [Structure du projet](#structure-du-projet)
7. [Protocole STOMP — Événements](#protocole-stomp--événements)
8. [Endpoint REST](#endpoint-rest)
9. [Documentation](#documentation)

---

## Présentation

**Your Car Your Way** est une plateforme de location de véhicules. Ce dépôt contient le **POC du module de chat en direct**, permettant aux clients de contacter le support en temps réel et aux agents de gérer plusieurs conversations simultanément.

Le POC remplace une implémentation initiale en Node.js / Socket.IO par une architecture **Spring Boot + STOMP** côté serveur, et **Angular 17 + @stomp/stompjs + NgRx** côté client.

---

## Fonctionnalités

### Côté Client
- Démarrer une conversation de support (nom, email, sujet)
- Envoyer et recevoir des messages en temps réel
- Indicateur de frappe (*typing*)
- Clôturer la conversation avec une note et un commentaire
- File d'attente avec position et temps estimé

### Côté Agent
- Se connecter au système de support
- Gérer plusieurs sessions de chat simultanément (configurable)
- Envoyer et recevoir des messages en temps réel
- Indicateur de frappe (*typing*)
- Changer sa disponibilité (disponible / indisponible)
- Clôturer une conversation

### Général
- Attribution automatique des clients aux agents disponibles
- File d'attente FIFO quand aucun agent n'est disponible
- Statistiques en temps réel (sessions actives, clients en attente, agents disponibles)

---

## Architecture technique



| Couche           | Technologie                          |
|------------------|--------------------------------------|
| **Frontend**     | Angular 17, Angular Material, NgRx, @stomp/stompjs |
| **Backend**      | Java 17, Spring Boot 3.2, Spring WebSocket, STOMP |
| **Communication**| WebSocket avec protocole STOMP (+ fallback SockJS) |
| **État (front)** | NgRx Store + Effects                 |
| **Données**      | En mémoire (ConcurrentHashMap) — POC uniquement |

---

## Prérequis

| Outil       | Version minimale |
|-------------|------------------|
| **Java**    | 17               |
| **Maven**   | 3.8+             |
| **Node.js** | 18+              |
| **npm**     | 9+               |
| **Angular CLI** | 17+          |

---

## Installation et lancement

### 1. Cloner le dépôt

```bash
git clone https://github.com/ChrystopherDeregnaucourt/OC_P13.git
cd OC_P13
```

### 2. Lancer le backend

```bash
cd backend
mvn spring-boot:run
```

Le serveur démarre sur **http://localhost:8080**.

### 3. Lancer le frontend

```bash
cd frontend
npm install
npm start
```

L'application démarre sur **http://localhost:4200** avec un proxy configuré vers le backend.

### 4. Utiliser l'application

| URL                          | Description                        |
|------------------------------|------------------------------------|
| http://localhost:4200/chat   | Interface client (chat support)    |
| http://localhost:4200/agent  | Console agent (tableau de bord)    |

> **Astuce** : ouvrir deux onglets (un client, un agent) pour tester une conversation complète.

---

## Protocole STOMP — Événements

### Client → Serveur (`/app/...`)

| Destination STOMP         | Description                     | Payload                                          |
|---------------------------|---------------------------------|--------------------------------------------------|
| `/app/client.startChat`   | Démarrer un chat                | `{ name, email, subject }`                       |
| `/app/client.message`     | Envoyer un message              | `{ sessionId, content }`                         |
| `/app/client.typing`      | Indicateur de frappe            | `{ sessionId, isTyping }`                        |
| `/app/client.endChat`     | Clôturer le chat                | `{ sessionId, rating, feedback }`                |
| `/app/agent.login`        | Connexion d'un agent            | `{ name, maxChats }`                             |
| `/app/agent.message`      | Message de l'agent              | `{ sessionId, content }`                         |
| `/app/agent.typing`       | Indicateur de frappe (agent)    | `{ sessionId, isTyping }`                        |
| `/app/agent.setAvailability` | Changer la disponibilité     | `{ available }`                                  |
| `/app/agent.endChat`      | Agent clôture une session       | `{ sessionId }`                                  |

### Serveur → Client (`/user/queue/...`)

| Destination                      | Description                        |
|----------------------------------|------------------------------------|
| `/user/queue/chat.started`       | Chat démarré (agent assigné)       |
| `/user/queue/chat.queued`        | Client mis en file d'attente       |
| `/user/queue/chat.message`       | Nouveau message reçu               |
| `/user/queue/chat.typing`        | Indicateur de frappe reçu          |
| `/user/queue/chat.ended`         | Session terminée                   |
| `/user/queue/chat.newSession`    | Nouvelle session assignée (agent)  |
| `/user/queue/agent.loggedIn`     | Confirmation de connexion agent    |
| `/user/queue/agent.stats`        | Mise à jour des statistiques       |
| `/user/queue/queue.update`       | Mise à jour position file d'attente|

---

## Endpoint REST

| Méthode | URL          | Description                                              |
|---------|--------------|----------------------------------------------------------|
| `GET`   | `/api/stats` | Statistiques en temps réel (sessions actives, agents, file d'attente) |

**Exemple de réponse :**

```json
{
  "activeSessions": 2,
  "waitingClients": 1,
  "availableAgents": 3,
  "totalAgents": 5
}
```

---

## Documentation

Les documents de conception et d'analyse sont disponibles dans le dossier `Doc/` :

| Fichier                          | Contenu                                              |
|----------------------------------|------------------------------------------------------|
| `Architecture_Definition.pdf`    | Définition de l'architecture technique du projet      |
| `Business_Requirements_V2.pdf`   | Exigences métier et spécifications fonctionnelles     |
| `Compliance_Assessment.pdf`      | Évaluation de la conformité (RGPD, sécurité, etc.)   |

---

## Technologies utilisées

### Backend
- **Java 17**
- **Spring Boot 3.2.2**
- **Spring WebSocket** (STOMP)
- **Jackson** (sérialisation JSON + support `java.time`)

### Frontend
- **Angular 17.3**
- **Angular Material 17.3**
- **NgRx 17.2** (Store, Effects, DevTools)
- **@stomp/stompjs 7** (client STOMP)
- **RxJS 7.8**
- **TypeScript 5.4**

---

## Auteur

**Chrystopher Deregnaucourt** — Projet 13, parcours OpenClassrooms Développeur Full-Stack.
