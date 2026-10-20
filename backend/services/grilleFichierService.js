const ExcelJS = require('exceljs');
const Grille = require('../models/Grille');
const ApiError = require('../middlewares/ApiError');
const { NIVEAUX_CENTRE, TYPES_REPONSE } = require('../models/enumUtils');
const { verifierPublication } = require('./grilleService');

/**
 * Export / import d'une grille, en JSON ou en Excel (même contenu, aller-retour sans perte).
 * Sert à charger la grille officielle, livrée séparément, et à la faire relire hors application.
 *
 * Format Excel (3 feuilles) :
 *   Grille    : paires clé / valeur (code, nom, niveaux_cibles, seuil_A, seuil_B, seuil_C)
 *   Domaines  : code, nom, poids, plafond_si_eliminatoire, ordre
 *   Criteres  : domaine, code, libelle, aide, type_reponse, points_max, poids, obligatoire, eliminatoire,
 *               sans_objet_autorise, preuve_exigee, options, bareme, condition_critere, condition_valeur, ordre
 *     options : « CODE:points:libellé » séparés par des retours à la ligne ou « ; »
 *     bareme  : « min-max=points » séparés par « ; » (borne vide = ouverte), ex. « 0-49=0; 50-74=1; 90-=3 »
 */

const PREUVES = ['AUCUNE', 'PHOTO', 'DOCUMENT'];
const COLONNES_DOMAINES = ['code', 'nom', 'poids', 'plafond_si_eliminatoire', 'ordre'];
const COLONNES_CRITERES = ['domaine', 'code', 'libelle', 'aide', 'type_reponse', 'points_max', 'poids', 'obligatoire',
  'eliminatoire', 'sans_objet_autorise', 'preuve_exigee', 'options', 'bareme', 'condition_critere', 'condition_valeur', 'ordre'];

// ─── Représentation neutre (JSON) ───

/** Grille → objet JSON propre (sans identifiants techniques ni statut). */
const versJson = (grille) => {
  const g = typeof grille.toObject === 'function' ? grille.toObject() : grille;
  return {
    code: g.code,
    nom: g.nom,
    version: g.version,
    niveauxCibles: g.niveauxCibles,
    classes: (g.classes || []).map(({ classe, min, max }) => ({ classe, min, max })),
    domaines: g.domaines.map((d) => ({
      code: d.code,
      nom: d.nom,
      poids: d.poids,
      plafondSiEliminatoire: d.plafondSiEliminatoire,
      ordre: d.ordre,
      criteres: d.criteres.map((c) => ({
        code: c.code,
        libelle: c.libelle,
        aide: c.aide,
        typeReponse: c.typeReponse,
        options: c.options?.length ? c.options.map(({ code, libelle, points }) => ({ code, libelle, points })) : undefined,
        bareme: c.bareme?.seuils?.length ? { seuils: c.bareme.seuils.map(({ min, max, points }) => ({ min, max, points })) } : undefined,
        pointsMax: c.pointsMax,
        poids: c.poids,
        obligatoire: c.obligatoire,
        eliminatoire: c.eliminatoire,
        sansObjetAutorise: c.sansObjetAutorise,
        preuveExigee: c.preuveExigee,
        condition: c.condition?.critere ? { critere: c.condition.critere, valeur: c.condition.valeur } : undefined,
        ordre: c.ordre,
      })),
    })),
  };
};

// ─── Export Excel ───

const formaterOptions = (options = []) => options.map((o) => `${o.code}:${o.points ?? 0}:${o.libelle ?? ''}`).join('\n');
const formaterBareme = (bareme) => (bareme?.seuils || []).map((s) => `${s.min ?? ''}-${s.max ?? ''}=${s.points}`).join('; ');
const ouiNon = (b) => (b ? 'oui' : 'non');

const versExcel = async (grille) => {
  const g = versJson(grille);
  const classeur = new ExcelJS.Workbook();
  classeur.creator = 'Diagnostic des centres';
  const entete = (feuille) => { feuille.getRow(1).font = { bold: true }; feuille.views = [{ state: 'frozen', ySplit: 1 }]; };
  const seuil = (classe) => g.classes.find((c) => c.classe === classe)?.min;

  const meta = classeur.addWorksheet('Grille');
  meta.columns = [{ header: 'cle', width: 18 }, { header: 'valeur', width: 50 }];
  entete(meta);
  [['code', g.code], ['nom', g.nom], ['version', g.version], ['niveaux_cibles', (g.niveauxCibles || []).join(';')],
    ['seuil_A', seuil('A')], ['seuil_B', seuil('B')], ['seuil_C', seuil('C')]].forEach((l) => meta.addRow(l));

  const domaines = classeur.addWorksheet('Domaines');
  domaines.columns = COLONNES_DOMAINES.map((h) => ({ header: h, width: h === 'nom' ? 40 : 14 }));
  entete(domaines);
  g.domaines.forEach((d) => domaines.addRow([d.code, d.nom, d.poids, d.plafondSiEliminatoire, d.ordre]));

  const criteres = classeur.addWorksheet('Criteres');
  criteres.columns = COLONNES_CRITERES.map((h) => ({
    header: h, width: { libelle: 50, aide: 36, options: 36, bareme: 28 }[h] || 14,
  }));
  entete(criteres);
  g.domaines.forEach((d) => d.criteres.forEach((c) => {
    const ligne = criteres.addRow([d.code, c.code, c.libelle, c.aide, c.typeReponse, c.pointsMax, c.poids, ouiNon(c.obligatoire),
      ouiNon(c.eliminatoire), ouiNon(c.sansObjetAutorise), c.preuveExigee, formaterOptions(c.options), formaterBareme(c.bareme),
      c.condition?.critere, c.condition?.valeur, c.ordre]);
    ligne.alignment = { vertical: 'top', wrapText: true };
  }));

  return classeur.xlsx.writeBuffer();
};

// ─── Import ───

const normaliserEntete = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');

const texte = (cellule) => {
  const v = cellule.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && !(v instanceof Date)) {
    if ('result' in v) return String(v.result ?? '').trim();
    if ('text' in v) return String(v.text ?? '').trim();
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join('').trim();
  }
  return String(v).trim();
};

/** Lignes d'une feuille en objets { entete: valeur }, avec le numéro de ligne. */
const lignesDe = (feuille) => {
  const entetes = {};
  feuille.getRow(1).eachCell((c, n) => { entetes[n] = normaliserEntete(texte(c)); });
  const lignes = [];
  for (let n = 2; n <= feuille.rowCount; n++) {
    const ligne = { _ligne: n };
    Object.entries(entetes).forEach(([col, nom]) => { ligne[nom] = texte(feuille.getRow(n).getCell(Number(col))); });
    if (Object.entries(ligne).some(([k, v]) => k !== '_ligne' && v)) lignes.push(ligne);
  }
  return lignes;
};

const nombre = (v) => (v === '' || v === undefined ? undefined : Number(String(v).replace(',', '.')));
const booleen = (v, defaut) => {
  const s = normaliserEntete(v);
  if (!s) return defaut;
  return ['oui', 'o', 'yes', 'true', 'vrai', '1', 'x'].includes(s);
};

const lireOptions = (v) => String(v || '').split(/\r?\n|;/).map((s) => s.trim()).filter(Boolean).map((s) => {
  const [code, points, ...libelle] = s.split(':');
  return { code: code.trim(), points: nombre(points) ?? 0, libelle: libelle.join(':').trim() || code.trim() };
});

const lireBareme = (v, erreurs, ou) => String(v || '').split(/[;\n]/).map((s) => s.trim()).filter(Boolean).map((s) => {
  const m = /^(-?[\d.,]*)\s*-\s*(-?[\d.,]*)\s*=\s*(-?[\d.,]+)$/.exec(s);
  if (!m) {
    erreurs.push(`${ou} : seuil de barème illisible « ${s} » (format min-max=points)`);
    return null;
  }
  return { min: nombre(m[1]), max: nombre(m[2]), points: nombre(m[3]) };
}).filter(Boolean);

/** Classeur Excel → objet grille (même forme que versJson). */
const depuisExcel = async (buffer) => {
  const classeur = new ExcelJS.Workbook();
  try {
    await classeur.xlsx.load(buffer);
  } catch {
    throw ApiError.badRequest('Fichier illisible : envoyez un classeur Excel .xlsx ou un fichier .json');
  }
  const feuilles = Object.fromEntries(['Grille', 'Domaines', 'Criteres'].map((n) => [n,
    classeur.worksheets.find((f) => normaliserEntete(f.name) === normaliserEntete(n))]));
  const absentes = Object.entries(feuilles).filter(([, f]) => !f).map(([n]) => n);
  if (absentes.length) throw ApiError.badRequest(`Feuilles absentes du classeur : ${absentes.join(', ')}`, ['Feuilles attendues : Grille, Domaines, Criteres']);

  const erreurs = [];
  const meta = Object.fromEntries(lignesDe(feuilles.Grille).map((l) => [normaliserEntete(l.cle), l.valeur]));
  const seuils = { A: nombre(meta.seuil_a) ?? 80, B: nombre(meta.seuil_b) ?? 60, C: nombre(meta.seuil_c) ?? 40 };

  const domaines = lignesDe(feuilles.Domaines).map((l) => ({
    code: l.code, nom: l.nom, poids: nombre(l.poids), plafondSiEliminatoire: nombre(l.plafond_si_eliminatoire) ?? 40, ordre: nombre(l.ordre), criteres: [],
  }));
  const parCode = new Map(domaines.map((d) => [d.code, d]));

  for (const l of lignesDe(feuilles.Criteres)) {
    const ou = `Criteres ligne ${l._ligne}`;
    const domaine = parCode.get(l.domaine);
    if (!domaine) {
      erreurs.push(`${ou} : domaine inconnu « ${l.domaine} »`);
      continue;
    }
    const typeReponse = normaliserEntete(l.type_reponse).toUpperCase();
    if (!TYPES_REPONSE.includes(typeReponse)) erreurs.push(`${ou} : type de réponse inconnu « ${l.type_reponse} »`);
    const preuve = normaliserEntete(l.preuve_exigee).toUpperCase() || 'AUCUNE';
    if (!PREUVES.includes(preuve)) erreurs.push(`${ou} : preuve exigée inconnue « ${l.preuve_exigee} »`);
    domaine.criteres.push({
      code: l.code,
      libelle: l.libelle,
      aide: l.aide || undefined,
      typeReponse,
      options: lireOptions(l.options),
      bareme: { seuils: lireBareme(l.bareme, erreurs, ou) },
      pointsMax: nombre(l.points_max) ?? 1,
      poids: nombre(l.poids) ?? 1,
      obligatoire: booleen(l.obligatoire, true),
      eliminatoire: booleen(l.eliminatoire, false),
      sansObjetAutorise: booleen(l.sans_objet_autorise, false),
      preuveExigee: preuve,
      condition: l.condition_critere ? { critere: l.condition_critere, valeur: l.condition_valeur } : undefined,
      ordre: nombre(l.ordre),
    });
  }

  return {
    grille: {
      code: meta.code,
      nom: meta.nom,
      niveauxCibles: String(meta.niveaux_cibles || '').split(/[;,]/).map((s) => normaliserEntete(s).toUpperCase()).filter(Boolean),
      classes: [
        { classe: 'A', min: seuils.A, max: 100 }, { classe: 'B', min: seuils.B, max: seuils.A },
        { classe: 'C', min: seuils.C, max: seuils.B }, { classe: 'D', min: 0, max: seuils.C },
      ],
      domaines,
    },
    erreurs,
  };
};

const depuisJson = (buffer) => {
  try {
    return { grille: JSON.parse(buffer.toString('utf8')), erreurs: [] };
  } catch {
    throw ApiError.badRequest('Fichier JSON illisible');
  }
};

/**
 * Importe une grille depuis un fichier .json ou .xlsx. Elle est toujours créée en BROUILLON
 * (version 1, ou version suivante si le code existe déjà), à relire puis publier.
 * En simulation, rien n'est enregistré. Renvoie { simulation, grille, resume, erreurs, avertissements }.
 */
const importerGrille = async (buffer, nomFichier, { simulation = true, auteurId } = {}) => {
  const { grille: donnees, erreurs } = /\.json$/i.test(nomFichier) ? depuisJson(buffer) : await depuisExcel(buffer);

  if (!donnees.code) erreurs.push('Le code de la grille est obligatoire');
  if (!donnees.nom) erreurs.push('Le nom de la grille est obligatoire');
  const inconnus = (donnees.niveauxCibles || []).filter((n) => !NIVEAUX_CENTRE.includes(n));
  if (inconnus.length) erreurs.push(`Niveaux ciblés inconnus : ${inconnus.join(', ')}`);

  const code = String(donnees.code || '').trim().toUpperCase();
  const derniere = code ? await Grille.findOne({ code }).sort({ version: -1 }).select('version').lean() : null;
  if (code && await Grille.exists({ code, statut: 'BROUILLON' })) {
    erreurs.push(`Un brouillon de la grille ${code} existe déjà : supprimez-le ou modifiez-le avant d'importer`);
  }

  const grille = new Grille({
    code, nom: donnees.nom, niveauxCibles: (donnees.niveauxCibles || []).filter((n) => NIVEAUX_CENTRE.includes(n)),
    domaines: donnees.domaines || [], ...(donnees.classes?.length && { classes: donnees.classes }),
    version: derniere ? derniere.version + 1 : 1, statut: 'BROUILLON', creePar: auteurId,
  });
  try {
    await grille.validate();
  } catch (err) {
    erreurs.push(...(err.errors ? Object.values(err.errors).map((e) => e.message) : [err.message]));
  }
  const { erreurs: bloquantesPublication, avertissements } = verifierPublication(grille);
  // Ce qui empêcherait la publication est signalé, mais n'empêche pas l'import en brouillon
  avertissements.unshift(...bloquantesPublication.map((e) => `À corriger avant publication : ${e}`));

  if (!simulation && !erreurs.length) await grille.save();
  return {
    simulation,
    enregistree: !simulation && !erreurs.length,
    grille: { _id: grille._id, code: grille.code, nom: grille.nom, version: grille.version },
    resume: {
      domaines: grille.domaines.length,
      criteres: grille.domaines.reduce((s, d) => s + d.criteres.length, 0),
      totalPoids: grille.domaines.reduce((s, d) => s + (d.poids || 0), 0),
    },
    erreurs: [...new Set(erreurs)],
    avertissements: [...new Set(avertissements)],
  };
};

module.exports = { versJson, versExcel, importerGrille };
