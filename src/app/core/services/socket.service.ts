import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { environment } from '../../../environments/environment';

/**
 * Service d'abstraction de la connexion STOMP over WebSocket (SockJS).
 *
 * Gère le cycle de vie de la connexion WebSocket conformément
 * à l'exigence TECH-007 (communication temps réel) et à l'architecture
 * cible Spring WebSocket + STOMP définie dans l'ADD (§5.3.1).
 *
 * En production, ce service se connecte au Support Service
 * (Spring Boot + Spring WebSocket + STOMP) via SockJS.
 *
 * Responsabilités :
 * - Établir et maintenir la connexion STOMP via SockJS
 * - Exposer les messages reçus sous forme d'Observables RxJS
 * - Envoyer des messages vers le serveur via les destinations STOMP
 */
@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private client: Client | null = null;
  private readonly destroy$ = new Subject<void>();
  private readonly connected$ = new BehaviorSubject<boolean>(false);
  private readonly stompSubscriptions: StompSubscription[] = [];

  /**
   * Établit la connexion au broker STOMP via SockJS.
   * Idempotent : si déjà connecté, ne fait rien.
   */
  connect(): void {
    if (this.client?.connected) {
      return;
    }

    this.client = new Client({
      // SockJS comme transport WebSocket (compatible Spring Boot SockJS endpoint)
      webSocketFactory: () => new SockJS(`${environment.wsBaseUrl}/ws`) as WebSocket,
      // Reconnexion automatique toutes les 2 secondes
      reconnectDelay: 2000,
      // Heartbeat désactivé pour ce POC (activé côté Spring en production)
      heartbeatIncoming: 0,
      heartbeatOutgoing: 0,
      debug: (msg) => {
        if (!environment.production) {
          console.log('[STOMP]', msg);
        }
      }
    });

    this.client.onConnect = () => {
      console.log('[SocketService] Connecté au broker STOMP');
      this.connected$.next(true);
    };

    this.client.onDisconnect = () => {
      console.log('[SocketService] Déconnecté du broker STOMP');
      this.connected$.next(false);
    };

    this.client.onStompError = (frame) => {
      console.error('[SocketService] Erreur STOMP:', frame.headers['message']);
    };

    this.client.activate();
  }

  /**
   * Ferme proprement la connexion STOMP.
   */
  disconnect(): void {
    if (this.client) {
      this.stompSubscriptions.forEach(sub => sub.unsubscribe());
      this.stompSubscriptions.length = 0;
      this.client.deactivate();
      this.client = null;
      this.connected$.next(false);
    }
  }

  /**
   * Envoie un message vers une destination STOMP.
   * Correspond à l'annotation @MessageMapping côté Spring.
   * @param destination Destination STOMP (ex: /app/chat.start)
   * @param body Données à transmettre (sérialisées en JSON)
   */
  send<T = unknown>(destination: string, body: T): void {
    if (!this.client?.connected) {
      console.warn('[SocketService] STOMP non connecté. Impossible d\'envoyer vers:', destination);
      return;
    }
    this.client.publish({
      destination,
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' }
    });
  }

  /**
   * S'abonne à une destination STOMP et retourne les messages sous forme d'Observable.
   * Correspond aux topics/queues Spring (@SendTo, SimpMessagingTemplate).
   * @param destination Destination à écouter (ex: /user/queue/chat.message)
   * @returns Observable émettant les données reçues (désérialisées depuis JSON)
   */
  subscribe<T = unknown>(destination: string): Observable<T> {
    return new Observable<T>((subscriber) => {
      let stompSub: StompSubscription | null = null;

      const performSubscription = () => {
        if (!this.client?.connected) return;

        stompSub = this.client.subscribe(destination, (message: IMessage) => {
          try {
            const data: T = JSON.parse(message.body);
            subscriber.next(data);
          } catch {
            subscriber.next(message.body as unknown as T);
          }
        });
        this.stompSubscriptions.push(stompSub);
      };

      if (this.client?.connected) {
        performSubscription();
      } else {
        // Attendre la connexion avant de souscrire
        const connSub = this.connected$.subscribe((connected) => {
          if (connected) {
            connSub.unsubscribe();
            performSubscription();
          }
        });
        subscriber.add(() => connSub.unsubscribe());
      }

      // Nettoyage lors de l'unsubscribe
      return () => {
        if (stompSub) {
          stompSub.unsubscribe();
          const idx = this.stompSubscriptions.indexOf(stompSub);
          if (idx > -1) this.stompSubscriptions.splice(idx, 1);
        }
      };
    });
  }

  /**
   * Indique si la connexion est active.
   */
  get isConnected(): boolean {
    return this.client?.connected ?? false;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.disconnect();
  }
}
