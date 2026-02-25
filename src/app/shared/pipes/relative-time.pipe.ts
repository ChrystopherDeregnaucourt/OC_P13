import { Pipe, PipeTransform } from '@angular/core';

/**
 * Pipe Angular transformant une date en temps relatif lisible.
 * Exemples : "À l'instant", "Il y a 3 min", "Il y a 1 h".
 *
 * Pipe impure pour recalculer à chaque cycle de détection.
 */
@Pipe({
  name: 'relativeTime',
  standalone: true,
  pure: false
})
export class RelativeTimePipe implements PipeTransform {
  transform(value: Date | string | null): string {
    if (!value) {
      return '';
    }

    const date = typeof value === 'string' ? new Date(value) : value;
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);

    if (diffSec < 30) {
      return 'À l\'instant';
    }
    if (diffMin < 1) {
      return `Il y a ${diffSec} s`;
    }
    if (diffMin < 60) {
      return `Il y a ${diffMin} min`;
    }
    if (diffHour < 24) {
      return `Il y a ${diffHour} h`;
    }

    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
