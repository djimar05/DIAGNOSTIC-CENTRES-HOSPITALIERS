const ExcelJS = require('exceljs');
const Centre = require('../models/Centre');
const Zone = require('../models/Zone');
const ApiError = require('../middlewares/ApiError');
const { NIVEAUX_CENTRE } = require('../models/enumUtils');

/**
 * Import des centres depuis un fichier Excel (.xlsx), une ligne par centre.
 * Le code du centre est la clé : un code existant met à jour le centre, un code nouveau le crée.
 * Relancer le même fichier ne crée donc pas de doublons.
 *
 * Mode simulation : chaque ligne est contrôlée (y compris par les règles du modèle) sans rien enregistrer.
 * Mode réel : les lignes valides sont enregistrées, les lignes en erreur sont ignorées et signalées.
 */

const MAX_LIGNES = 5000;
const STATUTS_JURIDIQUES = ['PUBLIC', 'CONFESSIONNEL', 'PRIVE', 'COMMUNAUTAIRE', 'ONG'];

// Colonnes du modèle. `titre` est l'en-tête attendu (la casse, les accents et les espaces sont ignorés).
const COLONNES = [
  { cle: 'code', titre: 'code', obligatoire: true, largeur: 14, aide: 'Code unique du centre (clé de mise à jour)', exemple: 'CS-0142' },
  { cle: 'nom', titre: 'nom', obligatoire: true, largeur: 32, aide: 'Nom de la formation sanitaire', exemple: 'CS Quartier Nord' },
  { cle: 'niveau', titre: 'niveau', obligatoire: true, largeur: 20, aide: `Un de : ${NIVEAUX_CENTRE.join(', ')}`, exemple: 'CENTRE_SANTE' },
  { cle: 'statutJuridique', titre: 'statut_juridique', largeur: 18, aide: `Un de : ${STATUTS_JURIDIQUES.join(', ')} (PUBLIC si vide)`, exemple: 'PUBLIC' },
  { cle: 'zone', titre: 'code_zone', obligatoire: true, largeur: 14, aide: 'Code de la zone de rattachement (feuille « Zones »)', exemple: 'DS-01-01' },
  { cle: 'localite', titre: 'localite', largeur: 20, aide: 'Village, quartier', exemple: 'Quartier Nord' },
  { cle: 'longitude', titre: 'longitude', largeur: 12, aide: 'Degrés décimaux, entre -180 et 180', exemple: 15.0444 },
  { cle: 'latitude', titre: 'latitude', largeur: 12, aide: 'Degrés décimaux, entre -90 et 90', exemple: 12.1348 },
  { cle: 'populationDesservie', titre: 'population_desservie', largeur: 20, aide: 'Nombre entier', exemple: 18500 },
  { cle: 'nombreLits', titre: 'nombre_lits', largeur: 12, aide: 'Nombre entier', exemple: 6 },
  { cle: 'services', titre: 'services', largeur: 36, aide: 'Séparés par des points-virgules', exemple: 'CONSULTATION;MATERNITE;VACCINATION' },
  { cle: 'responsableNom', titre: 'responsable_nom', largeur: 22, aide: 'Nom du responsable', exemple: 'Major du centre' },
  { cle: 'responsableTelephone', titre: 'responsable_telephone', largeur: 20, aide: 'Téléphone du responsable', exemple: '+235 66 00 00 03' },
  { cle: 'actif', titre: 'actif', largeur: 8, aide: 'oui / non (oui si vide)', exemple: 'oui' },
];

/** "Code zone", "CODE_ZONE", "code-zone" → "code_zone" ; "Centre de santé" → "CENTRE_DE_SANTE" (en majuscules). */
const normaliser = (texte) => String(texte ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .trim().replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');

// Libellés et abréviations courants acceptés en plus des codes
const ALIAS_NIVEAUX = {
  HN: 'HOPITAL_NATIONAL', HOPITAL_NATIONAL_DE_REFERENCE: 'HOPITAL_NATIONAL',
  HR: 'HOPITAL_REGIONAL', HOPITAL_REGIONAL_DE_REFERENCE: 'HOPITAL_REGIONAL',
  HD: 'HOPITAL_DISTRICT', HOPITAL_DE_DISTRICT: 'HOPITAL_DISTRICT',
  CS: 'CENTRE_SANTE', CENTRE_DE_SANTE: 'CENTRE_SANTE',
  PS: 'POSTE_SANTE', POSTE_DE_SANTE: 'POSTE_SANTE',
};

const lireNiveau = (texte) => {
  const n = normaliser(texte).toUpperCase();
  return NIVEAUX_CENTRE.includes(n) ? n : ALIAS_NIVEAUX[n];
};

const lireStatut = (texte) => {
  const s = normaliser(texte).toUpperCase();
  return STATUTS_JURIDIQUES.includes(s) ? s : undefined;
};

const lireNombre = (texte) => {
  const n = Number(String(texte).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

const lireBooleen = (texte) => {
  const b = normaliser(texte).toLowerCase();
  if (['', 'oui', 'o', 'yes', 'y', 'vrai', 'true', '1', 'actif'].includes(b)) return true;
  if (['non', 'n', 'no', 'faux', 'false', '0', 'inactif'].includes(b)) return false;
  return undefined;
};

/** Valeur texte d'une cellule, quel que soit son type (nombre, formule, lien, texte enrichi…). */
const texteCellule = (cellule) => {
  const v = cellule.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && !(v instanceof Date)) {
    if ('result' in v) return String(v.result ?? '').trim();
    if ('text' in v) return String(v.text ?? '').trim();
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join('').trim();
  }
  return String(cellule.text ?? v).trim();
};

/** Transforme une ligne Excel en données de centre. Renvoie { donnees, erreurs }. */
const analyserLigne = (valeurs, zonesParCode) => {
  const erreurs = [];
  const donnees = {};

  for (const col of COLONNES.filter((c) => c.obligatoire)) {
    if (!valeurs[col.cle]) erreurs.push(`${col.titre} est obligatoire`);
  }
  if (valeurs.code) donnees.code = valeurs.code;
  if (valeurs.nom) donnees.nom = valeurs.nom;

  if (valeurs.niveau) {
    donnees.niveau = lireNiveau(valeurs.niveau);
    if (!donnees.niveau) erreurs.push(`niveau inconnu : « ${valeurs.niveau} »`);
  }

  donnees.statutJuridique = 'PUBLIC';
  if (valeurs.statutJuridique) {
    donnees.statutJuridique = lireStatut(valeurs.statutJuridique);
    if (!donnees.statutJuridique) erreurs.push(`statut_juridique inconnu : « ${valeurs.statutJuridique} »`);
  }

  if (valeurs.zone) {
    const zone = zonesParCode.get(valeurs.zone.toUpperCase());
    if (!zone) erreurs.push(`zone inconnue : « ${valeurs.zone} »`);
    else if (zone.niveau === 'NATIONAL') erreurs.push('un centre ne peut pas être rattaché à la zone nationale');
    else {
      donnees.zone = zone._id;
      donnees.zoneAncetres = [...zone.ancetres, zone._id];
    }
  }

  if (valeurs.localite) donnees.localite = valeurs.localite;

  if (valeurs.longitude || valeurs.latitude) {
    const lng = lireNombre(valeurs.longitude);
    const lat = lireNombre(valeurs.latitude);
    if (!valeurs.longitude || !valeurs.latitude) erreurs.push('longitude et latitude vont ensemble');
    else if (!(lng >= -180 && lng <= 180)) erreurs.push(`longitude invalide : « ${valeurs.longitude} »`);
    else if (!(lat >= -90 && lat <= 90)) erreurs.push(`latitude invalide : « ${valeurs.latitude} »`);
    else donnees.gps = { type: 'Point', coordinates: [lng, lat] };
  }

  for (const cle of ['populationDesservie', 'nombreLits']) {
    if (!valeurs[cle]) continue;
    const n = lireNombre(valeurs[cle]);
    if (!Number.isInteger(n) || n < 0) erreurs.push(`${COLONNES.find((c) => c.cle === cle).titre} doit être un entier positif`);
    else donnees[cle] = n;
  }

  if (valeurs.services) {
    donnees.services = valeurs.services.split(/[;,]/).map((s) => normaliser(s).toUpperCase()).filter(Boolean);
  }
  if (valeurs.responsableNom || valeurs.responsableTelephone) {
    donnees.responsable = { nom: valeurs.responsableNom || undefined, telephone: valeurs.responsableTelephone || undefined };
  }

  donnees.actif = lireBooleen(valeurs.actif);
  if (donnees.actif === undefined) erreurs.push(`actif doit valoir oui ou non : « ${valeurs.actif} »`);

  return { donnees, erreurs };
};

/** Lit le classeur : feuille « Centres » (ou la première), ligne 1 = en-têtes. */
const lireClasseur = async (buffer) => {
  const classeur = new ExcelJS.Workbook();
  try {
    await classeur.xlsx.load(buffer);
  } catch {
    throw ApiError.badRequest('Fichier illisible : envoyez un classeur Excel au format .xlsx');
  }
  const feuille = classeur.getWorksheet('Centres') || classeur.worksheets[0];
  if (!feuille) throw ApiError.badRequest('Le classeur ne contient aucune feuille');

  const colonnesParTitre = new Map(COLONNES.map((c) => [c.titre, c]));
  const position = {}; // cle → numéro de colonne
  feuille.getRow(1).eachCell((cellule, numero) => {
    const col = colonnesParTitre.get(normaliser(texteCellule(cellule)).toLowerCase());
    if (col) position[col.cle] = numero;
  });
  const manquantes = COLONNES.filter((c) => c.obligatoire && !position[c.cle]).map((c) => c.titre);
  if (manquantes.length) {
    throw ApiError.badRequest(`Colonnes obligatoires absentes de la ligne 1 : ${manquantes.join(', ')}`, [
      `Colonnes attendues : ${COLONNES.map((c) => c.titre).join(', ')}`,
    ]);
  }

  const lignes = [];
  for (let n = 2; n <= feuille.rowCount; n++) {
    const ligne = feuille.getRow(n);
    const valeurs = {};
    for (const [cle, numero] of Object.entries(position)) valeurs[cle] = texteCellule(ligne.getCell(numero));
    if (Object.values(valeurs).some(Boolean)) lignes.push({ numero: n, valeurs }); // lignes vides ignorées
  }
  if (lignes.length > MAX_LIGNES) {
    throw ApiError.badRequest(`Trop de lignes (${lignes.length}) : ${MAX_LIGNES} au maximum par fichier`);
  }
  return lignes;
};

const messagesValidation = (err) => (err.errors ? Object.values(err.errors).map((e) => e.message) : [err.message]);

/**
 * Contrôle (et, hors simulation, enregistre) chaque ligne.
 * Renvoie { simulation, resume: { total, crees, misAJour, inchanges, erreurs }, lignes: [...] }.
 */
const importerCentres = async (buffer, { simulation = true } = {}) => {
  const lignes = await lireClasseur(buffer);

  const zones = await Zone.find().select('code niveau ancetres').lean();
  const zonesParCode = new Map(zones.map((z) => [z.code.toUpperCase(), z]));
  const codes = lignes.map((l) => l.valeurs.code).filter(Boolean);
  const existants = new Map((await Centre.find({ code: { $in: codes } })).map((c) => [c.code, c]));
  const premiereLigneDuCode = new Map();

  const rapport = [];
  for (const { numero, valeurs } of lignes) {
    const { donnees, erreurs } = analyserLigne(valeurs, zonesParCode);

    if (donnees.code) {
      if (premiereLigneDuCode.has(donnees.code)) erreurs.push(`code déjà utilisé ligne ${premiereLigneDuCode.get(donnees.code)}`);
      else premiereLigneDuCode.set(donnees.code, numero);
    }

    let statut = 'ERREUR';
    if (!erreurs.length) {
      const existant = existants.get(donnees.code);
      const centre = existant || new Centre();
      centre.set(donnees);
      try {
        await centre.validate();
        if (!existant) statut = 'CREE';
        else statut = centre.isModified() ? 'MIS_A_JOUR' : 'INCHANGE';
        if (!simulation && statut !== 'INCHANGE') await centre.save();
      } catch (err) {
        erreurs.push(...messagesValidation(err));
        statut = 'ERREUR';
      }
    }
    rapport.push({ ligne: numero, code: valeurs.code, nom: valeurs.nom, statut, erreurs });
  }

  const compter = (s) => rapport.filter((l) => l.statut === s).length;
  return {
    simulation,
    resume: {
      total: rapport.length, crees: compter('CREE'), misAJour: compter('MIS_A_JOUR'),
      inchanges: compter('INCHANGE'), erreurs: compter('ERREUR'),
    },
    lignes: rapport,
  };
};

/** Modèle Excel vide : feuille « Centres » à remplir, aide, listes de valeurs et zones existantes. */
const genererModele = async () => {
  const classeur = new ExcelJS.Workbook();
  classeur.creator = 'Diagnostic des centres';

  const feuille = classeur.addWorksheet('Centres', { views: [{ state: 'frozen', ySplit: 1 }] });
  feuille.columns = COLONNES.map((c) => ({ header: c.titre, key: c.cle, width: c.largeur }));
  feuille.getRow(1).eachCell((cellule, numero) => {
    const col = COLONNES[numero - 1];
    cellule.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cellule.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: col.obligatoire ? 'FF0B7285' : 'FF5C7C8A' } };
    cellule.note = col.aide;
  });

  const listes = classeur.addWorksheet('Listes');
  listes.columns = [{ header: 'niveau', width: 22 }, { header: 'statut_juridique', width: 18 }];
  listes.getRow(1).font = { bold: true };
  NIVEAUX_CENTRE.forEach((n, i) => { listes.getCell(i + 2, 1).value = n; });
  STATUTS_JURIDIQUES.forEach((s, i) => { listes.getCell(i + 2, 2).value = s; });

  // Listes déroulantes sur les colonnes niveau et statut juridique
  const colonne = (cle) => feuille.getColumn(cle).letter;
  feuille.dataValidations.add(`${colonne('niveau')}2:${colonne('niveau')}${MAX_LIGNES + 1}`, {
    type: 'list', allowBlank: true, formulae: [`Listes!$A$2:$A$${NIVEAUX_CENTRE.length + 1}`],
  });
  feuille.dataValidations.add(`${colonne('statutJuridique')}2:${colonne('statutJuridique')}${MAX_LIGNES + 1}`, {
    type: 'list', allowBlank: true, formulae: [`Listes!$B$2:$B$${STATUTS_JURIDIQUES.length + 1}`],
  });

  const zones = classeur.addWorksheet('Zones');
  zones.columns = [{ header: 'code_zone', width: 14 }, { header: 'nom', width: 30 }, { header: 'niveau', width: 22 }];
  zones.getRow(1).font = { bold: true };
  const toutes = await Zone.find({ niveau: { $ne: 'NATIONAL' }, actif: true }).select('code nom niveau ancetres').lean();
  toutes
    .sort((a, b) => a.ancetres.length - b.ancetres.length || a.code.localeCompare(b.code))
    .forEach((z) => zones.addRow([z.code, z.nom, z.niveau]));

  const aide = classeur.addWorksheet('Aide');
  aide.columns = [{ header: 'colonne', width: 24 }, { header: 'obligatoire', width: 12 }, { header: 'description', width: 60 }, { header: 'exemple', width: 36 }];
  aide.getRow(1).font = { bold: true };
  COLONNES.forEach((c) => aide.addRow([c.titre, c.obligatoire ? 'oui' : '', c.aide, c.exemple]));
  aide.addRow([]);
  aide.addRow(['', '', 'Une ligne par centre dans la feuille « Centres ». Un code déjà connu met le centre à jour.']);

  return classeur.xlsx.writeBuffer();
};

module.exports = { importerCentres, genererModele, COLONNES, normaliser };
