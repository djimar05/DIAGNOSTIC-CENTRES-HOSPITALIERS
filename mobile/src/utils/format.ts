// Date de visite prévue : un jour du calendrier stocké à minuit UTC (ISODate("2026-10-20")).
// Affichée et comparée en UTC, pour donner le même jour quel que soit le fuseau du téléphone.
const formatJour = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const formatLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export const formatDate = (iso?: string | null) => (iso ? formatJour.format(new Date(iso)) : 'Date à fixer');
export const formatDateLongue = (iso?: string | null) => (iso ? formatLong.format(new Date(iso)) : 'Date à fixer');

export const nomComplet = (p?: { prenom?: string; nom: string } | null) => (p ? [p.prenom, p.nom].filter(Boolean).join(' ') : '');

/** Le jour prévu est-il avant aujourd'hui (jour du téléphone) ? Même règle que le serveur. */
export const jourPasse = (iso: string) => {
  const d = new Date();
  return new Date(iso).getTime() < Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
};
