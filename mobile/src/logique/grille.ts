import type { Critere, Domaine, Grille, Reponse, StatutEvaluation } from '@/api/types';

/**
 * Règles de la grille côté téléphone (mêmes règles que backend/services/scoreService.js) :
 * conditions d'affichage, critère répondu, progression par domaine.
 */

export const STATUTS_MODIFIABLES: StatutEvaluation[] = ['EN_COURS', 'A_CORRIGER'];
export const TYPES_NON_NOTES = ['TEXTE', 'PHOTO', 'GPS', 'DATE'];

const normaliser = (v: unknown) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (['oui', 'true', 'vrai', 'yes', 'o'].includes(s)) return true;
    if (['non', 'false', 'faux', 'no', 'n'].includes(s)) return false;
  }
  return v;
};

export const valeursEgales = (a: unknown, b: unknown): boolean => {
  if (Array.isArray(a)) return a.some((x) => valeursEgales(x, b));
  const na = normaliser(a);
  const nb = normaliser(b);
  if (typeof na === 'boolean' || typeof nb === 'boolean') return na === nb;
  if (typeof na === 'number' || typeof nb === 'number') return Number(na) === Number(nb);
  return String(na ?? '').trim().toLowerCase() === String(nb ?? '').trim().toLowerCase();
};

export type IndexReponses = Map<string, Reponse>;
export const indexer = (reponses: Reponse[] = []): IndexReponses => new Map(reponses.map((r) => [r.critereCode, r]));

/** Le critère est-il affiché ? (condition sur la réponse d'un autre critère) */
export const estApplicable = (critere: Critere, reponses: IndexReponses) => {
  const cible = critere.condition?.critere;
  return !cible || valeursEgales(reponses.get(cible)?.valeur, critere.condition?.valeur);
};

const vide = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/** Le critère a-t-il une réponse (valeur, photo pour un critère PHOTO, ou « sans objet ») ? */
export const estRepondu = (critere: Critere, reponse?: Reponse) => {
  if (!reponse) return false;
  if (reponse.sansObjet) return true;
  if (critere.typeReponse === 'PHOTO') return Boolean(reponse.fichiers?.length);
  return !vide(reponse.valeur);
};

/** Preuve exigée mais absente ? */
export const preuveManquante = (critere: Critere, reponse?: Reponse) => (
  Boolean(critere.preuveExigee && critere.preuveExigee !== 'AUCUNE' && reponse && !reponse.sansObjet && !reponse.fichiers?.length)
);

/** Critères affichés, dans l'ordre de la grille, avec leur domaine. */
export const criteresApplicables = (grille: Grille, reponses: IndexReponses) => grille.domaines.flatMap(
  (domaine) => domaine.criteres.filter((c) => estApplicable(c, reponses)).map((critere) => ({ critere, domaine })),
);

/** Progression d'un domaine : critères répondus / affichés, et s'il reste un problème. */
export const progressionDomaine = (domaine: Domaine, reponses: IndexReponses) => {
  const affiches = domaine.criteres.filter((c) => estApplicable(c, reponses));
  const repondus = affiches.filter((c) => estRepondu(c, reponses.get(c.code)));
  const aCompleter = affiches.filter((c) => (c.obligatoire !== false && !estRepondu(c, reponses.get(c.code))) || preuveManquante(c, reponses.get(c.code)));
  return { total: affiches.length, repondus: repondus.length, aCompleter: aCompleter.length, premierACompleter: aCompleter[0]?.code };
};

/** Aide pour un barème numérique : « 0–49 → 0 pt · 50–74 → 1 pt… » */
export const libelleBareme = (critere: Critere) => (critere.bareme?.seuils || [])
  .map((s) => `${s.min ?? '…'}${s.max !== undefined && s.max !== null ? `–${s.max}` : ' et +'} → ${s.points} pt`)
  .join(' · ');

/** Contrôle doux d'une valeur numérique : hors des bornes du barème ? */
export const horsBareme = (critere: Critere, valeur: number) => {
  const seuils = critere.bareme?.seuils || [];
  if (!seuils.length) return false;
  const min = Math.min(...seuils.map((s) => s.min ?? Infinity));
  const maxs = seuils.map((s) => s.max).filter((m): m is number => typeof m === 'number');
  const max = maxs.length === seuils.length ? Math.max(...maxs) : Infinity;
  return valeur < min || valeur > max;
};
