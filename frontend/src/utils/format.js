const formatJour = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });
const formatJourHeure = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

export const formatDate = (iso) => (iso ? formatJour.format(new Date(iso)) : '—');
export const formatDateHeure = (iso) => (iso ? formatJourHeure.format(new Date(iso)) : '—');

/** "2026-10-20T…" → "2026-10-20", pour les champs <input type="date">. */
export const versChampDate = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

/**
 * Date de visite prévue : un jour du calendrier stocké à minuit UTC (ISODate("2026-10-20")).
 * Affichée et comparée en UTC, pour donner le même jour quel que soit le fuseau du navigateur.
 */
const formatJourCalendaire = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' });
export const formatDatePrevue = (iso) => (iso ? formatJourCalendaire.format(new Date(iso)) : '—');

/** Aujourd'hui au format "2026-10-20" (jour local), à comparer avec versChampDate(datePrevue). */
export const aujourdhuiISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const nomComplet = (u) => (u ? [u.prenom, u.nom].filter(Boolean).join(' ') : '');

/** Pour comparer des textes saisis : minuscules, sans accents. */
export const normaliserRecherche = (texte) => String(texte || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const initiales = (u) => `${u?.prenom?.[0] || ''}${u?.nom?.[0] || ''}`.toUpperCase();
