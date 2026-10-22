const formatJour = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const formatLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export const formatDate = (iso?: string | null) => (iso ? formatJour.format(new Date(iso)) : 'Date à fixer');
export const formatDateLongue = (iso?: string | null) => (iso ? formatLong.format(new Date(iso)) : 'Date à fixer');

export const nomComplet = (p?: { prenom?: string; nom: string } | null) => (p ? [p.prenom, p.nom].filter(Boolean).join(' ') : '');

/** Début du jour courant (pour comparer des dates de visite). */
export const debutDuJour = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
