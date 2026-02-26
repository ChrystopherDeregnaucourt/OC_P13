import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { Client, IMessage } from '@stomp/stompjs';
import { environment } from '../../../environments/environment';

/**
 * Service d'abstraction de la connexion STOMP over WebSocket.
 *
 * Remplace le SocketService (Socket.IO) du POC Node.js.
 * Utilise @stomp/stompjs pour communiquer avec le backend
 * Spring Boot / Spring WebSocket + STOMP.
 *
 * Conformité TECH-007 (communication temps réel).
 *
 * Responsabilités :
 * - Établir et maintenir la connexion STOMP/WebSocket
 * - Exposer les messages reçus sous forme d'Observables RxJS
 * - Envoyer des messages vers le serveur via /app/...
 * - Gérer l'identité utilisateur via le header STOMP "login"
 */
@Injectable({ providedIn: 'root' })
export class StompService implements OnDestroy {
  private client: Client | null = null;
  private readonly destroy$ = new Subject<void>();
  private readonly connected$ = new BehaviorSubject<boolean>(false);

  /** UUID unique identifiant cet utilisateur (envoyé en header STOMP login) */
  private userId: string = '';

  /**
   * Établit la connexion au broker STOMP.
   * Idempotent : si déjà connecté, ne fait rien.
   */
  connect(): void {
    if (this.client?.connected) {
      return;
    }

    // Générer un UUID pour identifier cette connexion
    this.userId = crypto.randomUUID();

    this.client = new Client({
      brokerURL: environment.wsUrl,
      connectHeaders: {
        login: this.userId
      },
      debug: (str) => {
        // Activer en dev si besoin : console.log('[STOMP]', str);
      },
      reconnectDelay: 2000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        console.log('[StompService] Connecté au serveur STOMP, userId:', this.userId);
        this.connected$.next(true);
      },
      onDisconnect: () => {
        console.log('[StompService] Déconnecté');
        this.connected$.next(false);
      },
      onStompError: (frame) => {
        console.error('[StompService] Erreur STOMP:', frame.headers['message'], frame.body);
      },
      onWebSocketError: (event) => {
        console.error('[StompService] Erreur WebSocket:', event);
      }
    });

    this.client.activate();
  }

  /**
   * Ferme proprement la connexion STOMP.
   */
  disconnect(): void {
    if (this.client) {
      this.client.deactivate();
      this.client = null;
      this.connected$.next(false);
    }
  }

  /**
   * Envoie un message vers le serveur via une destination STOMP /app/...
   * @param destination Destination STOMP (ex: '/client.startChat')
   * @param body Objet à sérialiser en JSON
   */
  send<T = unknown>(destination: string, body: T): void {
    if (!this.client?.connected) {
      console.warn('[StompService] Non connecté. Impossible d\'envoyer vers:', destination);
      return;
    }
    this.client.publish({
      destination: '/app' + destination,
      body: JSON.stringify(body)
    });
  }

  /**
   * Souscrit à une destination serveur → client (/user/queue/...) et
   * retourne un Observable émettant les messages désérialisés.
   * @param destination Destination STOMP (ex: '/queue/chat.started')
   * @returns Observable émettant les données reçues
   */
  subscribe<T = unknown>(destination: string): Observable<T> {
    return new Observable<T>((subscriber) => {
      // Attendre que la connexion soit établie
      const trySubscribe = () => {
        if (!this.client?.connected) {
          // Réessayer après un court délai
          const timer = setTimeout(trySubscribe, 100);
          return () => clearTimeout(timer);
        }

        const subscription = this.client!.subscribe(
          '/user' + destination,
          (message: IMessage) => {
            try {
              const data: T = JSON.parse(message.body);
              subscriber.next(data);
            } catch (e) {
              console.error('[StompService] Erreur de parsing:', e);
            }
          }
        );

        return () => subscription.unsubscribe();
      };

      const cleanup = trySubscribe();
      return () => {
        if (typeof cleanup === 'function') cleanup();
      };
    });
  }

  /**
   * Indique si la connexion est active.
   */
  get isConnected(): boolean {
    return this.client?.connected ?? false;
  }

  /**
   * Observable de l'état de connexion.
   */
  get connectionState$(): Observable<boolean> {
    return this.connected$.asObservable();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.disconnect();
  }
}
