/**
 * Calcul des scores d'une évaluation – fonction PURE (aucun accès à la base).
 * Utilisée à la validation d'une évaluation et pour l'aperçu d'une grille.
 *
 * Règles du cahier des charges :
 *   - score d'un critère   s_c = points obtenus / points maximum ; « sans objet » exclu du dénominateur
 *   - score d'un domaine   = moyenne des s_c pondérée par le poids w_c des critères, ramenée sur 100
 *   - score global         = Σ score_d × p_d (p_d = poids du domaine, en %)
 *   - un critère éliminatoire non satisfait plafonne le score de son domaine (plafondSiEliminatoire)
 *   - classe : A ≥ 80, B ≥ 60, C ≥ 40, D < 40 (seuils de la grille)
 *
 * Précisions retenues (le cahier ne les tranche pas) :
 *   - éliminatoire « non satisfait » = le critère obtient 0 point
 *   - domaine sans aucun critère noté applicable → exclu du global, poids des autres redistribués
 *   - barème NOMBRE : on retient le dernier seuil (trié par min) dont le min est ≤ valeur
 *   - classe calculée sur le score global arrondi à 1 décimale (celui qui est affiché)
 *   - condition d'affichage non remplie → critère automatiquement « sans objet »
 *   - critères non notés : TEXTE, PHOTO, GPS, DATE, et NOMBRE sans barème
 *   - critère non répondu : exclu du calcul, signalé dans `manquants` (la soumission exige les obligatoires)
 */

const TYPES_NON_NOTES = ['TEXTE', 'PHOTO', 'GPS', 'DATE'];

const arrondir = (x, decimales = 1) => {
  const f = 10 ** decimales;
  return Math.round(x * f) / f;
};

const estVide = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/** "Oui" / "oui" / true / "vrai" → true ; "Non" / false → false ; sinon la valeur telle quelle. */
const normaliser = (v) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (['oui', 'true', 'vrai', 'yes', 'o'].includes(s)) return true;
    if (['non', 'false', 'faux', 'no', 'n'].includes(s)) return false;
  }
  return v;
};

const valeursEgales = (a, b) => {
  if (Array.isArray(a)) return a.some((x) => valeursEgales(x, b)); // choix multiple : contient
  const na = normaliser(a);
  const nb = normaliser(b);
  if (typeof na === 'boolean' || typeof nb === 'boolean') return na === nb;
  if (typeof na === 'number' || typeof nb === 'number') return Number(na) === Number(nb);
  return String(na).trim().toLowerCase() === String(nb).trim().toLowerCase();
};

/** Le critère est-il noté (contribue-t-il au score) ? */
const estNote = (critere) => {
  if (TYPES_NON_NOTES.includes(critere.typeReponse)) return false;
  if (critere.typeReponse === 'NOMBRE' && !critere.bareme?.seuils?.length) return false;
  return (critere.pointsMax ?? 1) > 0;
};

/**
 * Points obtenus pour une valeur. Renvoie { points } ou { erreur }.
 * Les points sont bornés entre 0 et pointsMax.
 */
const pointsPour = (critere, valeur) => {
  const max = critere.pointsMax ?? 1;
  const borner = (p) => ({ points: Math.min(max, Math.max(0, p)) });

  switch (critere.typeReponse) {
    case 'OUI_NON': {
      const b = normaliser(valeur);
      if (typeof b !== 'boolean') return { erreur: `réponse Oui/Non attendue (reçu « ${valeur} »)` };
      return borner(b ? max : 0);
    }
    case 'ECHELLE_0_3': {
      const n = Number(valeur);
      if (![0, 1, 2, 3].includes(n)) return { erreur: `valeur 0, 1, 2 ou 3 attendue (reçu « ${valeur} »)` };
      return borner((n / 3) * max);
    }
    case 'NOMBRE': {
      const n = Number(valeur);
      if (!Number.isFinite(n)) return { erreur: `nombre attendu (reçu « ${valeur} »)` };
      const seuils = [...critere.bareme.seuils].sort((a, b) => (a.min ?? -Infinity) - (b.min ?? -Infinity));
      const seuil = seuils.filter((s) => (s.min ?? -Infinity) <= n).pop();
      return borner(seuil ? seuil.points : 0);
    }
    case 'CHOIX_UNIQUE': {
      const option = (critere.options || []).find((o) => o.code === valeur);
      if (!option) return { erreur: `option inconnue « ${valeur} »` };
      return borner(option.points ?? 0);
    }
    case 'CHOIX_MULTIPLE': {
      const codes = Array.isArray(valeur) ? valeur : [valeur];
      const inconnues = codes.filter((c) => !(critere.options || []).some((o) => o.code === c));
      if (inconnues.length) return { erreur: `option(s) inconnue(s) : ${inconnues.join(', ')}` };
      const total = codes.reduce((s, c) => s + ((critere.options.find((o) => o.code === c).points) ?? 0), 0);
      return borner(total);
    }
    default:
      return { points: null };
  }
};

/** Classe de performance : la plus haute dont le minimum est atteint. */
const classePour = (score, classes) => {
  if (score === null || score === undefined) return null;
  const triees = [...(classes || [])].sort((a, b) => b.min - a.min);
  return (triees.find((c) => score >= c.min) || triees[triees.length - 1] || {}).classe || null;
};

/**
 * Calcule les scores d'une évaluation avec la grille utilisée.
 *   evaluation : { reponses: [{ critereCode, valeur, sansObjet }] }
 *   grille     : { domaines: [{ code, nom, poids, plafondSiEliminatoire, criteres: [...] }], classes }
 *
 * Renvoie {
 *   scores:   { domaines: [{ domaineCode, nom, poids, score, scoreBrut, plafonne, criteresRepondus, criteresTotal }],
 *               global, classe, calculeLe },
 *   criteres: [{ domaineCode, critereCode, applicable, sansObjet, note, points, pointsMax, poids, score, eliminatoireNonSatisfait }],
 *   complet, manquants: [codes des critères obligatoires sans réponse], erreurs: [...]
 * }
 */
const calculer = (evaluation, grille, { maintenant = new Date() } = {}) => {
  const reponses = new Map((evaluation.reponses || []).map((r) => [r.critereCode, r]));
  const criteres = [];
  const manquants = [];
  const erreurs = [];

  const domaines = (grille.domaines || []).map((domaine) => {
    let sommePonderee = 0;
    let sommePoids = 0;
    let eliminatoire = false;
    let criteresTotal = 0;
    let criteresRepondus = 0;

    for (const critere of domaine.criteres || []) {
      const reponse = reponses.get(critere.code);
      const condition = critere.condition?.critere;
      const applicable = !condition || valeursEgales(reponses.get(condition)?.valeur, critere.condition.valeur);
      const detail = {
        domaineCode: domaine.code,
        critereCode: critere.code,
        applicable,
        sansObjet: !applicable || Boolean(reponse?.sansObjet),
        note: estNote(critere),
        points: null,
        pointsMax: critere.pointsMax ?? 1,
        poids: critere.poids ?? 1,
        score: null,
        eliminatoireNonSatisfait: false,
      };
      criteres.push(detail);
      if (!applicable) continue;
      criteresTotal++;

      if (reponse?.sansObjet) {
        criteresRepondus++;
        if (!critere.sansObjetAutorise) erreurs.push(`${critere.code} : « sans objet » n'est pas autorisé pour ce critère`);
        continue;
      }
      if (!reponse || estVide(reponse.valeur)) {
        if (critere.obligatoire !== false) manquants.push(critere.code);
        continue;
      }
      criteresRepondus++;
      if (!detail.note) continue;

      const { points, erreur } = pointsPour(critere, reponse.valeur);
      if (erreur) {
        erreurs.push(`${critere.code} : ${erreur}`);
        continue;
      }
      detail.points = points;
      detail.score = points / detail.pointsMax;
      sommePonderee += detail.poids * detail.score;
      sommePoids += detail.poids;
      if (critere.eliminatoire && points === 0) {
        detail.eliminatoireNonSatisfait = true;
        eliminatoire = true;
      }
    }

    const scoreBrut = sommePoids > 0 ? (sommePonderee / sommePoids) * 100 : null;
    const plafond = domaine.plafondSiEliminatoire ?? 40;
    const plafonne = eliminatoire && scoreBrut !== null && scoreBrut > plafond;
    const score = scoreBrut === null ? null : (plafonne ? plafond : scoreBrut);

    return {
      domaineCode: domaine.code,
      nom: domaine.nom,
      poids: domaine.poids,
      score: score === null ? null : arrondir(score),
      scoreBrut: scoreBrut === null ? null : arrondir(scoreBrut),
      plafonne,
      criteresRepondus,
      criteresTotal,
      _scoreExact: score, // pour le global, sans cumuler les arrondis
    };
  });

  const notes = domaines.filter((d) => d._scoreExact !== null);
  const poidsNotes = notes.reduce((s, d) => s + d.poids, 0);
  const global = poidsNotes > 0
    ? arrondir(notes.reduce((s, d) => s + d.poids * d._scoreExact, 0) / poidsNotes)
    : null;
  domaines.forEach((d) => { delete d._scoreExact; });

  return {
    scores: { domaines, global, classe: classePour(global, grille.classes), calculeLe: maintenant },
    criteres,
    complet: manquants.length === 0,
    manquants,
    erreurs,
  };
};

module.exports = { calculer, pointsPour, classePour, estNote, valeursEgales, arrondir };
