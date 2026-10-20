const formatJour = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });
const formatJourHeure = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

export const formatDate = (iso) => (iso ? formatJour.format(new Date(iso)) : '—');
export const formatDateHeure = (iso) => (iso ? formatJourHeure.format(new Date(iso)) : '—');

/** "2026-10-20T…" → "2026-10-20", pour les champs <input type="date">. */
export const versChampDate = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

export const nomComplet = (u) => (u ? [u.prenom, u.nom].filter(Boolean).join(' ') : '');

export const initiales = (u) => `${u?.prenom?.[0] || ''}${u?.nom?.[0] || ''}`.toUpperCase();
