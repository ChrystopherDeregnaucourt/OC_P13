-- =============================================================================
-- Your Car Your Way (YCYW) — Schéma de base de données
-- Base : PostgreSQL (comme spécifié dans l'Architecture Definition §5.3)
-- Date de création : 2026-02-26
-- =============================================================================
--
-- Ce fichier contient le schéma complet de l'application, organisé en 4 contextes
-- métier (Bounded Contexts) issus du document Architecture_Definition.pdf :
--
--   1. IDENTITY   — Utilisateurs, authentification, sessions
--   2. BOOKING    — Agences, véhicules, réservations, avis
--   3. SUPPORT    — Agents, chat, tickets, vidéo, FAQ  ← focus du POC
--   4. NOTIFICATION — Notifications transactionnelles
--
-- Les tables du contexte SUPPORT correspondent directement aux modèles Java
-- du POC (ChatSession, ChatMessage, SupportAgent).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Extension UUID (PostgreSQL)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  1. CONTEXTE IDENTITY — Utilisateurs et Authentification                ║
-- ║  (Réf: Architecture Definition §5.2.1, Business Requirements §4.1-4.2) ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- -----------------------------------------------------------------------------
-- Table : users
-- Rôle  : Stocke les comptes utilisateurs (clients et agents)
-- Réf   : AUTH-001 à AUTH-010, PROF-001 à PROF-008
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,          -- BCrypt (SEC-003)
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    phone           VARCHAR(20),
    role            VARCHAR(20)  NOT NULL DEFAULT 'CLIENT'
                        CHECK (role IN ('CLIENT', 'AGENT', 'ADMIN')),
    language        VARCHAR(5)   NOT NULL DEFAULT 'fr',  -- I18N-001 : fr, en, de, es, it
    currency        VARCHAR(3)   NOT NULL DEFAULT 'EUR', -- I18N-002 : EUR, GBP, USD
    timezone        VARCHAR(50)  NOT NULL DEFAULT 'Europe/Paris',
    email_verified  BOOLEAN      NOT NULL DEFAULT FALSE,
    two_factor_enabled BOOLEAN   NOT NULL DEFAULT FALSE,
    two_factor_secret  VARCHAR(255),                -- TOTP secret (AUTH-006)
    account_locked  BOOLEAN      NOT NULL DEFAULT FALSE,
    deletion_requested_at TIMESTAMPTZ,              -- PROF-008 : délai de 7 jours
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role  ON users (role);

-- -----------------------------------------------------------------------------
-- Table : driving_licenses
-- Rôle  : Permis de conduire des clients (photo incluse)
-- Réf   : PROF-003, Business Requirements §4.2
-- -----------------------------------------------------------------------------
CREATE TABLE driving_licenses (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    license_number  VARCHAR(50)  NOT NULL,
    country         VARCHAR(3)   NOT NULL,          -- Code ISO 3166-1 alpha-3
    issue_date      DATE         NOT NULL,
    expiry_date     DATE         NOT NULL,
    photo_path      VARCHAR(500),                   -- Chemin vers le fichier uploadé
    verified        BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_driving_licenses_user ON driving_licenses (user_id);

-- -----------------------------------------------------------------------------
-- Table : payment_methods
-- Rôle  : Moyens de paiement via Stripe
-- Réf   : PROF-004, TECH-005, TECH-006
-- -----------------------------------------------------------------------------
CREATE TABLE payment_methods (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_payment_id   VARCHAR(255) NOT NULL,      -- ID Stripe (pas de données carte en base)
    card_last_four      VARCHAR(4),                 -- 4 derniers chiffres (affichage uniquement)
    card_brand          VARCHAR(20),                -- visa, mastercard, etc.
    is_default          BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_methods_user ON payment_methods (user_id);

-- -----------------------------------------------------------------------------
-- Table : user_sessions
-- Rôle  : Sessions de connexion (historique, logout global)
-- Réf   : AUTH-008, AUTH-009
-- -----------------------------------------------------------------------------
CREATE TABLE user_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL,          -- Hash du JWT (jamais le token en clair)
    ip_address      VARCHAR(45),
    user_agent      VARCHAR(500),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ  NOT NULL,
    revoked         BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_user_sessions_user    ON user_sessions (user_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions (expires_at);

-- -----------------------------------------------------------------------------
-- Table : password_reset_tokens
-- Rôle  : Tokens de réinitialisation de mot de passe
-- Réf   : AUTH-005
-- -----------------------------------------------------------------------------
CREATE TABLE password_reset_tokens (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ  NOT NULL,
    used            BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_password_reset_user ON password_reset_tokens (user_id);

-- -----------------------------------------------------------------------------
-- Table : notification_preferences
-- Rôle  : Préférences de notification par utilisateur
-- Réf   : NOTIF-005, Business Requirements §4.5
-- -----------------------------------------------------------------------------
CREATE TABLE notification_preferences (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
    push_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    sms_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id)
);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  2. CONTEXTE BOOKING — Réservations et Véhicules                        ║
-- ║  (Réf: Architecture Definition §5.2.2, Business Requirements §4.3)      ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- -----------------------------------------------------------------------------
-- Table : agencies
-- Rôle  : Agences de location
-- Réf   : RENT-001, RENT-002
-- -----------------------------------------------------------------------------
CREATE TABLE agencies (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(200) NOT NULL,
    country         VARCHAR(3)   NOT NULL,          -- Code ISO
    city            VARCHAR(100) NOT NULL,
    address         VARCHAR(500) NOT NULL,
    latitude        DECIMAL(9,6),
    longitude       DECIMAL(9,6),
    phone           VARCHAR(20),
    email           VARCHAR(255),
    opening_hours   JSONB,                          -- Ex: {"mon":"08:00-19:00", ...}
    active          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agencies_country ON agencies (country);
CREATE INDEX idx_agencies_city    ON agencies (city);

-- -----------------------------------------------------------------------------
-- Table : vehicle_categories
-- Rôle  : Catégories de véhicules (codes ACRISS)
-- Réf   : RENT-003, Business Requirements §4.3.3
-- -----------------------------------------------------------------------------
CREATE TABLE vehicle_categories (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    acriss_code     VARCHAR(4) NOT NULL UNIQUE,     -- Code ACRISS (ex: CCAR)
    name            VARCHAR(100) NOT NULL,           -- Ex: "Compacte"
    description     TEXT,
    passenger_count INT NOT NULL DEFAULT 5,
    luggage_count   INT NOT NULL DEFAULT 2,
    has_ac          BOOLEAN NOT NULL DEFAULT TRUE,
    transmission    VARCHAR(10) NOT NULL DEFAULT 'AUTO'
                        CHECK (transmission IN ('AUTO', 'MANUAL'))
);

-- -----------------------------------------------------------------------------
-- Table : vehicle_models
-- Rôle  : Modèles de véhicules disponibles dans les agences
-- -----------------------------------------------------------------------------
CREATE TABLE vehicle_models (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id     UUID NOT NULL REFERENCES vehicle_categories(id),
    agency_id       UUID NOT NULL REFERENCES agencies(id),
    brand           VARCHAR(50)  NOT NULL,          -- Ex: "Renault"
    model           VARCHAR(50)  NOT NULL,          -- Ex: "Clio"
    year            INT,
    daily_rate      DECIMAL(10,2) NOT NULL,         -- Prix par jour en devise de base
    currency        VARCHAR(3)   NOT NULL DEFAULT 'EUR',
    available       BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_vehicle_models_agency   ON vehicle_models (agency_id);
CREATE INDEX idx_vehicle_models_category ON vehicle_models (category_id);

-- -----------------------------------------------------------------------------
-- Table : vehicle_photos
-- Rôle  : Photos des véhicules
-- -----------------------------------------------------------------------------
CREATE TABLE vehicle_photos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id      UUID NOT NULL REFERENCES vehicle_models(id) ON DELETE CASCADE,
    photo_path      VARCHAR(500) NOT NULL,          -- Chemin fichier / URL S3
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vehicle_photos_vehicle ON vehicle_photos (vehicle_id);

-- -----------------------------------------------------------------------------
-- Table : annonces
-- Rôle  : Annonces de location publiées par les agences pour un véhicule donné.
--         C'est l'entité visible côté client : elle décrit l'offre (prix, période,
--         kilométrage inclus, conditions) et peut être activée/désactivée.
-- Réf   : RENT-003, RENT-004
-- -----------------------------------------------------------------------------
CREATE TABLE annonces (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id       UUID NOT NULL REFERENCES agencies(id),
    vehicle_id      UUID NOT NULL REFERENCES vehicle_models(id),
    title           VARCHAR(200) NOT NULL,           -- Ex: "Renault Clio - Paris Centre"
    description     TEXT,                            -- Description libre de l'offre
    daily_rate      DECIMAL(10,2) NOT NULL,          -- Prix par jour affiché
    currency        VARCHAR(3)   NOT NULL DEFAULT 'EUR',
    km_included     INT,                             -- Kilomètres inclus par jour (NULL = illimité)
    available_from  DATE         NOT NULL,           -- Début de disponibilité
    available_to    DATE         NOT NULL,           -- Fin de disponibilité
    min_days        INT          NOT NULL DEFAULT 1, -- Durée minimum de location
    max_days        INT,                             -- Durée maximum (NULL = pas de limite)
    status          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('DRAFT', 'ACTIVE', 'INACTIVE', 'EXPIRED')),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_annonces_dates CHECK (available_to >= available_from),
    CONSTRAINT chk_annonces_min_days CHECK (min_days > 0),
    CONSTRAINT chk_annonces_max_days CHECK (max_days IS NULL OR max_days >= min_days)
);

CREATE INDEX idx_annonces_agency   ON annonces (agency_id);
CREATE INDEX idx_annonces_vehicle  ON annonces (vehicle_id);
CREATE INDEX idx_annonces_status   ON annonces (status);
CREATE INDEX idx_annonces_dates    ON annonces (available_from, available_to);

-- -----------------------------------------------------------------------------
-- Table : reservations
-- Rôle  : Réservations de véhicules
-- Réf   : RENT-005 à RENT-010
-- -----------------------------------------------------------------------------
CREATE TABLE reservations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id),
    vehicle_id      UUID NOT NULL REFERENCES vehicle_models(id),
    agency_id       UUID NOT NULL REFERENCES agencies(id),
    annonce_id      UUID REFERENCES annonces(id),   -- Annonce à l'origine de la réservation
    status          VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED'
                        CHECK (status IN ('PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED',
                                          'CANCELLED', 'MODIFIED')),
    start_date      TIMESTAMPTZ NOT NULL,
    end_date        TIMESTAMPTZ NOT NULL,
    total_price     DECIMAL(10,2) NOT NULL,
    currency        VARCHAR(3)   NOT NULL DEFAULT 'EUR',
    stripe_payment_id VARCHAR(255),                 -- Référence Stripe
    qr_code         VARCHAR(500),                   -- Chemin vers le QR code (RENT-007)
    cancelled_at    TIMESTAMPTZ,
    refund_amount   DECIMAL(10,2),                  -- Montant remboursé selon les règles métier
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reservations_user   ON reservations (user_id);
CREATE INDEX idx_reservations_status ON reservations (status);
CREATE INDEX idx_reservations_dates  ON reservations (start_date, end_date);

-- -----------------------------------------------------------------------------
-- Table : reservation_options
-- Rôle  : Options ajoutées à une réservation (GPS, siège bébé, etc.)
-- Réf   : RENT-006
-- -----------------------------------------------------------------------------
CREATE TABLE reservation_options (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id  UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    option_name     VARCHAR(100) NOT NULL,
    option_price    DECIMAL(10,2) NOT NULL,
    currency        VARCHAR(3)   NOT NULL DEFAULT 'EUR'
);

CREATE INDEX idx_reservation_options_res ON reservation_options (reservation_id);

-- -----------------------------------------------------------------------------
-- Table : reviews
-- Rôle  : Avis post-location (1–5 étoiles)
-- Réf   : RENT-012
-- -----------------------------------------------------------------------------
CREATE TABLE reviews (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id  UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    rating          INT  NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (reservation_id)     -- Un seul avis par réservation
);

CREATE INDEX idx_reviews_user ON reviews (user_id);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  3. CONTEXTE SUPPORT — Chat, Tickets, Vidéo, FAQ                        ║
-- ║  (Réf: Architecture Definition §5.2.3, Business Requirements §4.4)      ║
-- ║                                                                         ║
-- ║  ★ C'est le contexte principal du POC Chat ★                            ║
-- ║  Les tables chat_sessions, chat_messages et support_agents               ║
-- ║  correspondent aux modèles Java :                                        ║
-- ║    - ChatSession.java  → chat_sessions                                  ║
-- ║    - ChatMessage.java  → chat_messages                                  ║
-- ║    - SupportAgent.java → support_agents                                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- -----------------------------------------------------------------------------
-- Table : support_agents
-- Rôle  : Agents du support client
-- Modèle Java : SupportAgent.java
-- Réf   : SUPP-006 à SUPP-012
-- -----------------------------------------------------------------------------
-- Champs issus du modèle Java :
--   id             → id (UUID)
--   principalName  → principal_name (identifiant STOMP pour le routage WebSocket)
--   name           → name
--   available      → available
--   maxChats       → max_chats
--   currentChats   → current_chats (calculé en temps réel, mais persisté pour reprise)
-- -----------------------------------------------------------------------------
CREATE TABLE support_agents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id),      -- Lien vers le compte utilisateur (rôle AGENT)
    principal_name  VARCHAR(255) NOT NULL UNIQUE,    -- Identifiant STOMP (routage WebSocket)
    name            VARCHAR(100) NOT NULL,           -- Nom affiché
    available       BOOLEAN      NOT NULL DEFAULT TRUE,
    max_chats       INT          NOT NULL DEFAULT 3  -- Nombre max de chats simultanés
                        CHECK (max_chats > 0 AND max_chats <= 10),
    current_chats   INT          NOT NULL DEFAULT 0  -- Nombre actuel de chats en cours
                        CHECK (current_chats >= 0),
    last_active_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_support_agents_user      ON support_agents (user_id);
CREATE INDEX idx_support_agents_available ON support_agents (available);

-- -----------------------------------------------------------------------------
-- Table : chat_sessions
-- Rôle  : Sessions de chat en direct entre un client et un agent
-- Modèle Java : ChatSession.java
-- Réf   : SUPP-006 (démarrage), SUPP-007 (échange), SUPP-008 (file d'attente),
--          SUPP-012 (notation)
-- -----------------------------------------------------------------------------
-- Champs issus du modèle Java :
--   id             → id
--   clientId       → client_principal (principal STOMP)
--   clientName     → client_name
--   clientEmail    → client_email
--   agentId        → agent_id (FK vers support_agents)
--   agentName      → résolu par jointure
--   agentPrincipal → résolu par jointure
--   status         → status ('waiting', 'active', 'ended')
--   startedAt      → started_at
--   endedAt        → ended_at
--   rating         → rating (1-5)
--   feedback       → feedback
--   subject        → subject
-- -----------------------------------------------------------------------------
CREATE TABLE chat_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id       UUID REFERENCES users(id),      -- FK client (null si non authentifié dans le POC)
    client_principal VARCHAR(255) NOT NULL,          -- Principal STOMP du client (UUID)
    client_name     VARCHAR(100) NOT NULL,
    client_email    VARCHAR(255),
    agent_id        UUID REFERENCES support_agents(id),  -- Agent assigné (null si en attente)
    status          VARCHAR(10)  NOT NULL DEFAULT 'waiting'
                        CHECK (status IN ('waiting', 'active', 'ended')),
    subject         VARCHAR(100),                    -- Sujet choisi par le client
    started_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMPTZ,                     -- NULL si session en cours
    rating          INT CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5)),  -- SUPP-012
    feedback        TEXT,                            -- Commentaire libre du client
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_sessions_client  ON chat_sessions (client_id);
CREATE INDEX idx_chat_sessions_agent   ON chat_sessions (agent_id);
CREATE INDEX idx_chat_sessions_status  ON chat_sessions (status);
CREATE INDEX idx_chat_sessions_started ON chat_sessions (started_at);

-- -----------------------------------------------------------------------------
-- Table : chat_messages
-- Rôle  : Messages individuels dans une session de chat
-- Modèle Java : ChatMessage.java
-- Réf   : SUPP-007 (échange temps réel), SUPP-009 (indicateur de frappe N/A ici),
--          SUPP-010 (fichiers — champ attachment_path prévu)
-- -----------------------------------------------------------------------------
-- Champs issus du modèle Java :
--   id          → id
--   sessionId   → session_id (FK vers chat_sessions)
--   senderId    → sender_id
--   senderType  → sender_type ('client', 'agent', 'system')
--   content     → content
--   timestamp   → sent_at
-- + champs supplémentaires pour le partage de fichiers (SUPP-010)
-- -----------------------------------------------------------------------------
CREATE TABLE chat_messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    sender_id       VARCHAR(255) NOT NULL,           -- UUID du client/agent ou "system"
    sender_type     VARCHAR(10)  NOT NULL
                        CHECK (sender_type IN ('client', 'agent', 'system')),
    content         TEXT         NOT NULL,
    attachment_path VARCHAR(500),                    -- SUPP-010 : chemin du fichier partagé
    attachment_type VARCHAR(50),                     -- Type MIME du fichier
    attachment_size BIGINT,                          -- Taille en octets
    sent_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_session ON chat_messages (session_id);
CREATE INDEX idx_chat_messages_sent    ON chat_messages (sent_at);

-- -----------------------------------------------------------------------------
-- Table : support_tickets
-- Rôle  : Tickets de support asynchrone (messagerie)
-- Réf   : Business Requirements §4.4.1 (Messages asynchrones)
-- -----------------------------------------------------------------------------
CREATE TABLE support_tickets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id),
    agent_id        UUID REFERENCES support_agents(id),
    subject         VARCHAR(255) NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'OPEN'
                        CHECK (status IN ('OPEN', 'IN_PROGRESS', 'WAITING_CLIENT',
                                          'RESOLVED', 'CLOSED')),
    priority        VARCHAR(10)  NOT NULL DEFAULT 'MEDIUM'
                        CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    closed_at       TIMESTAMPTZ
);

CREATE INDEX idx_support_tickets_user   ON support_tickets (user_id);
CREATE INDEX idx_support_tickets_agent  ON support_tickets (agent_id);
CREATE INDEX idx_support_tickets_status ON support_tickets (status);

-- -----------------------------------------------------------------------------
-- Table : ticket_messages
-- Rôle  : Messages dans un ticket de support (avec pièces jointes)
-- Réf   : Business Requirements §4.4.1
-- -----------------------------------------------------------------------------
CREATE TABLE ticket_messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id       UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id),
    content         TEXT NOT NULL,
    attachment_path VARCHAR(500),                    -- Chemin de la pièce jointe
    attachment_name VARCHAR(255),                    -- Nom original du fichier
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ticket_messages_ticket ON ticket_messages (ticket_id);

-- -----------------------------------------------------------------------------
-- Table : video_calls
-- Rôle  : Visioconférences via Twilio
-- Réf   : Business Requirements §4.4.3
-- -----------------------------------------------------------------------------
CREATE TABLE video_calls (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id),
    agent_id        UUID REFERENCES support_agents(id),
    twilio_room_id  VARCHAR(255),                   -- Identifiant de la room Twilio
    status          VARCHAR(20)  NOT NULL DEFAULT 'SCHEDULED'
                        CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    scheduled_at    TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    duration_seconds INT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_video_calls_user  ON video_calls (user_id);
CREATE INDEX idx_video_calls_agent ON video_calls (agent_id);

-- -----------------------------------------------------------------------------
-- Table : help_categories
-- Rôle  : Catégories de la FAQ / Centre d'aide
-- Réf   : Business Requirements §4.4.4
-- -----------------------------------------------------------------------------
CREATE TABLE help_categories (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug            VARCHAR(100) NOT NULL UNIQUE,    -- URL-friendly ("reservation", "billing")
    sort_order      INT NOT NULL DEFAULT 0,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Table : help_articles
-- Rôle  : Articles d'aide / FAQ
-- Réf   : Business Requirements §4.4.4
-- -----------------------------------------------------------------------------
CREATE TABLE help_articles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id     UUID NOT NULL REFERENCES help_categories(id) ON DELETE CASCADE,
    slug            VARCHAR(200) NOT NULL UNIQUE,
    published       BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_help_articles_category ON help_articles (category_id);

-- -----------------------------------------------------------------------------
-- Table : help_article_translations
-- Rôle  : Traductions des articles d'aide (i18n)
-- Réf   : I18N-001 (5 langues : fr, en, de, es, it)
-- -----------------------------------------------------------------------------
CREATE TABLE help_article_translations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id      UUID NOT NULL REFERENCES help_articles(id) ON DELETE CASCADE,
    language        VARCHAR(5) NOT NULL,             -- fr, en, de, es, it
    title           VARCHAR(300) NOT NULL,
    content         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (article_id, language)
);

CREATE INDEX idx_help_translations_article ON help_article_translations (article_id);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  4. CONTEXTE NOTIFICATION                                               ║
-- ║  (Réf: Architecture Definition §5.2.4, Business Requirements §4.5)      ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- -----------------------------------------------------------------------------
-- Table : notifications
-- Rôle  : Notifications transactionnelles (email, push, SMS)
-- Réf   : NOTIF-001 à NOTIF-004
-- -----------------------------------------------------------------------------
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            VARCHAR(20) NOT NULL
                        CHECK (type IN ('EMAIL', 'PUSH', 'SMS')),
    category        VARCHAR(50) NOT NULL,            -- Ex: 'BOOKING_CONFIRMED', 'REMINDER_48H', etc.
    title           VARCHAR(300),
    content         TEXT NOT NULL,
    read            BOOLEAN      NOT NULL DEFAULT FALSE,
    sent_at         TIMESTAMPTZ,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications (user_id);
CREATE INDEX idx_notifications_read ON notifications (user_id, read);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  VUE UTILITAIRE POUR LE POC                                             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- -----------------------------------------------------------------------------
-- Vue : v_chat_session_summary
-- Rôle : Résumé d'une session de chat avec le nom de l'agent et le nombre de
--        messages — utile pour le dashboard agent et les statistiques.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_chat_session_summary AS
SELECT
    cs.id              AS session_id,
    cs.client_name,
    cs.client_email,
    cs.subject,
    cs.status,
    cs.started_at,
    cs.ended_at,
    cs.rating,
    cs.feedback,
    sa.name            AS agent_name,
    COUNT(cm.id)       AS message_count
FROM chat_sessions cs
LEFT JOIN support_agents sa ON cs.agent_id = sa.id
LEFT JOIN chat_messages cm  ON cm.session_id = cs.id
GROUP BY cs.id, sa.name;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  COMMENTAIRES SUR LES CHOIX DE CONCEPTION                               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
--
-- 1. TYPES UUID
--    Tous les identifiants sont des UUID v4 (comme dans les modèles Java).
--    Cela évite les conflits en environnement distribué (multi-région).
--
-- 2. TIMESTAMPS AVEC TIMEZONE (TIMESTAMPTZ)
--    L'application est internationale (I18N-003). Stocker en UTC via
--    TIMESTAMPTZ et convertir côté client selon le fuseau de l'utilisateur.
--
-- 3. CONTRAINTES CHECK
--    Les valeurs de statut et de type sont vérifiées en base pour garantir
--    la cohérence même si le code applicatif a un bug.
--    En production, on pourrait utiliser des types ENUM PostgreSQL.
--
-- 4. CHAMPS DU POC vs PRODUCTION
--    - chat_sessions.client_id est nullable car le POC n'a pas d'auth
--      (le client est identifié par client_principal / UUID STOMP).
--    - support_agents.current_chats est persisté pour permettre la reprise
--      après redémarrage, mais sera recalculé au démarrage du service.
--
-- 5. INDEX
--    Des index sont posés sur les colonnes de jointure (FK) et les colonnes
--    fréquemment filtrées (status, dates). À ajuster après analyse des
--    requêtes réelles en production.
--
-- 6. MIGRATIONS
--    En production, utiliser Flyway ou Liquibase pour versionner le schéma
--    (cf. copilot-instructions.md). Ce fichier sert de version initiale V1.
-- =============================================================================
