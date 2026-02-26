Always respond in French.

L'utilisateur est un débutant, tu vas lui répondre de façon claire et simple.

Il ne faut pas faire de commande Start-Sleep dans le terminal pour attendre une action.


Objectif

Tu accompagnes le développement d’une API REST Spring Boot servant de couche d’accès aux données MySQL et d’exposition sécurisée vers un front Angular.
Ta mission : accélérer sans dégrader la sécurité, l’architecture JPA (Controller → Service → Repository), la cohérence technique et la qualité documentaire.

Contexte

Back-end : Java 11/17, Spring Boot, Spring Web, Spring Data JPA, Spring Security JWT, Bean Validation (Jakarta), MySQL.

Front consommateur : Angular 14 (ou +).

Authentification : JWT. Toutes les routes sont authentifiées sauf explicitement listées (ex. POST /auth/login, POST /auth/register si applicable).

Gestion d’images (si concerné) : upload côté API → stockage serveur (filesystem) → persisté en base sous forme de métadonnées/chemin, pas de BLOB par défaut.

Outils : Swagger/OpenAPI pour la doc, Mockoon pour simuler le back-end en amont, Postman pour les tests d’API.

Versionnement : Git.

Comportement attendu de Copilot

Respect strict de l’architecture JPA

Ne génère pas de logique métier en Controller.

Place les règles métier en Service.

Utilise Repository uniquement pour l’accès aux données (interfaces Spring Data, méthodes dérivées ou @Query si nécessaire).

API REST claire et stable

Endpoints RESTful, noms au pluriel, stateless.

Réponses normalisées (200/201/204/400/401/403/404/409/422/500) et payloads consistants.

Validation systématique des DTO d’entrée via annotations Bean Validation + gestion d’erreurs centralisée (@ControllerAdvice).

Séparation nette des modèles

Entity (JPA) ≠ DTO (exposition) ≠ Request/Response (I/O).

Mappe via MapStruct (préféré) ou mappers dédiés.

Persistance

Requêtes efficaces, pagination/tri avec Pageable quand la liste peut être volumineuse.

Transactions au niveau Service (@Transactional) lorsque pertinent.

Évolution sûre

Ne supprime ni ne modifie les mécanismes critiques (auth, filtres, interceptors, validation globale, error handler) sans instruction explicite.

Propose des migrations incrémentales (nouveaux endpoints, nouvelles props) sans rupture d’API, ou documente toute rupture (changelog).

Sécurité (priorité absolue)

JWT & Spring Security

Toutes les routes protégées via filtre JWT (sauf login/register si présents).

Extraction du token depuis l’en-tête Authorization: Bearer <token>.

Ne place jamais de logique de sécurité dans les Controllers (utilise config Security + filters).

Mots de passe & secrets

Hash BCrypt (ou PasswordEncoder de Spring Security).

Jamais de mot de passe en clair, ni dans le code, ni dans les logs.

Credentials (DB, JWT secret, etc.) uniquement via variables d’environnement/application.yml + profiles Spring (dev, test, prod).

Surface d’attaque

Désérialisation sûre (DTO dédiés).

Validation stricte des inputs, limites sur upload (taille/type MIME), noms de fichiers nettoyés.

Pas d’exposition du stacktrace en prod, gestion d’erreurs générique.

En-têtes de sécurité conseillés (CORS configuré précisément, pas * en prod).

Gestion des fichiers/Images

Stockage sur disque dans un répertoire hors racine statique publique.

Sauvegarder seulement le chemin et les métadonnées en base.

Générer des noms de fichiers uniques (UUID), vérifier MIME côté serveur, taille max configurable.

Cohérence du code

Conventions : Java style guide, noms explicites, services/contrats centrés métier.

Paquetage : domain (entities), repository, service, web/controller, web/dto, security, config, exception, mapper, files (si upload).

Logs : slf4j avec niveaux adaptés (INFO pour flux, DEBUG pour diagnostic, jamais d’infos sensibles).

Tests : Unitaires (services/mappers), tests d’intégration Web (MockMvc/TestRestTemplate).

Erreurs : Format de réponse d’erreur unique (timestamp, path, code, message, details).

Communication avec le front Angular (consignes à générer côté front)

Copilot doit proposer/maintenir ces pratiques lorsqu’il suggère du code Angular.

Architecture Angular

Services par domaine (FeatureService) qui appellent l’API via HttpClient.

Interceptor JWT : ajout automatique de Authorization: Bearer <token> si l’utilisateur est authentifié.

Garde de route (CanActivate) pour les pages protégées.

Gestion du token

Stockage sécurisé (préférer HttpOnly cookie si back-end compatible ; sinon localStorage avec mitigation, jamais dans les logs).

Rafraîchissement si un flux de refresh token est en place ; sinon redirection vers login à 401.

Environnements

URLs d’API dans environment.ts / environment.prod.ts. Ne jamais hardcoder d’URL dans les services.

Erreurs & UX

Gestion uniforme des erreurs HTTP au niveau de l’interceptor (toast/snackbar + mapping messages).

Upload d’images via FormData, types autorisés et tailles vérifiées côté client, mais la confiance reste côté serveur.

Documentation & outils

Swagger / OpenAPI

Exposer la doc à /swagger-ui.html ou /swagger-ui et /v3/api-docs.

Documenter chaque endpoint (tags, summary, request/response, codes d’erreurs).

Sécuriser l’UI en prod (accès restreint) ; activer l’auth Bearer dans l’UI (bouton “Authorize”).

Mockoon

Maintenir un profil de mocks synchronisé avec le contrat OpenAPI (routes, schémas, statuts).

Utiliser Mockoon pour le front quand l’API réelle n’est pas disponible.

Postman

Fournir/mettre à jour une collection et des environnements (dev, test, prod) avec variables (baseURL, token).

Inclure des requêtes d’auth, d’upload, et des scénarios d’erreurs.

Paramétrage & déploiement

Configuration Spring via application.yml par profil ; secrets injectés par variables d’environnement.

Migrations DB : privilégier Flyway/Liquibase pour l’évolution du schéma.

CORS : liste blanche explicite des origines ; pas * en prod.

Observabilité : endpoints Actuator protégés (profil dev/test ouvert de façon limitée, prod restreint).

Exemples de comportements attendus
✅ À faire

Proposer un Controller minimal, un Service avec validations métier, un Repository typé, et des DTO d’I/O dédiés.

Ajouter un interceptor JWT Angular lors de la création d’un nouveau module consommateur de l’API.

Lors de l’ajout d’un endpoint de liste, suggérer Page<T> + Pageable et documenter la pagination dans Swagger.

Pour l’upload d’image : créer un endpoint POST /resources/{id}/image, accepter multipart/form-data, vérifier le type, générer un nom de fichier, stocker, puis sauver le chemin en base.

⛔ À éviter

Mettre de la logique métier dans un Controller.

Bypasser la sécurité (désactiver des filtres, marquer des endpoints comme permitAll()) sans demande explicite.

Logger des tokens JWT, des mots de passe, ou des credentials DB.

Exposer des entités JPA directement au front (pas de Entity dans les réponses).

Utiliser des chemins d’upload dans un répertoire public accessible tel quel ou des noms de fichiers fournis par l’utilisateur.

Modèle de squelette (réutilisable)
src/main/java/...
  ├─ config/            # Swagger, CORS, Jackson, etc.
  ├─ security/          # Config Security, JWT filter, services d'auth
  ├─ domain/            # Entities JPA (@Entity)
  ├─ repository/        # Interfaces JPA
  ├─ service/           # Règles métier (@Service)
  ├─ web/controller/    # REST Controllers
  ├─ web/dto/           # DTO Request/Response
  ├─ mapper/            # MapStruct ou mappers manuels
  ├─ exception/         # Exceptions + @ControllerAdvice
  └─ files/             # Gestion upload (si applicable)

Rappels opérationnels à maintenir

Toujours fournir/mettre à jour : commentaires Javadoc clés, annotations Swagger, collection Postman, config Mockoon.

Toujours préserver : filtres/security config, validation globale, gestion d’erreurs, conventions de nommage, profils Spring.

Toujours proposer : tests pertinents, pagination/tri quand utile, messages d’erreurs exploitables.

Clause d’adaptabilité

Si le projet évolue (nouvelles entités, flux de refresh token, storage d’images différent, multi-tenancy), adapte tes suggestions sans casser l’architecture, la sécurité, ni les contrats d’API existants. Toute rupture doit être explicitement signalée et documentée.
