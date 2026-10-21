const Affectation = require('../models/Affectation');
const Utilisateur = require('../models/Utilisateur');
const Zone = require('../models/Zone');
const droitsService = require('./droitsService');

/**
 * Équipes des missions : un évaluateur doit avoir une affectation EVALUATEUR active couvrant le centre ;
 * le superviseur, une affectation SUPERVISEUR ou COORDONNATEUR couvrant le centre.
 */
const ROLES_EVALUATION = ['EVALUATEUR'];
const ROLES_SUPERVISION = ['SUPERVISEUR', 'COORDONNATEUR'];

/** Affectations actives des utilisateurs donnés, pour les rôles donnés, groupées par utilisateur. */
const affectationsDe = async (utilisateurIds, roles) => {
  const affectations = await Affectation.find({
    utilisateur: { $in: utilisateurIds }, role: { $in: roles }, ...droitsService.conditionsActives(),
  }).lean();
  const parUtilisateur = new Map();
  affectations.forEach((a) => parUtilisateur.set(String(a.utilisateur), [...(parUtilisateur.get(String(a.utilisateur)) || []), a]));
  return parUtilisateur;
};

/**
 * Prépare la vérification d'une équipe (une seule lecture en base, réutilisée pour chaque centre).
 * Renvoie une fonction (centre) → liste des problèmes (vide si l'équipe convient à ce centre).
 */
const preparerVerification = async ({ evaluateurs = [], superviseur } = {}) => {
  const ids = [...new Set([...evaluateurs, superviseur].filter(Boolean).map(String))];
  const [utilisateurs, affEval, affSup] = await Promise.all([
    Utilisateur.find({ _id: { $in: ids } }).select('nom prenom actif').lean(),
    affectationsDe(evaluateurs, ROLES_EVALUATION),
    superviseur ? affectationsDe([superviseur], ROLES_SUPERVISION) : new Map(),
  ]);
  const parId = new Map(utilisateurs.map((u) => [String(u._id), u]));
  const nom = (id) => { const u = parId.get(String(id)); return u ? [u.prenom, u.nom].filter(Boolean).join(' ') : String(id); };

  return (centre) => {
    const problemes = [];
    const objet = { zoneAncetres: centre.zoneAncetres, centre: centre._id };
    for (const id of evaluateurs) {
      const u = parId.get(String(id));
      if (!u) problemes.push(`évaluateur introuvable (${id})`);
      else if (!u.actif) problemes.push(`${nom(id)} : compte désactivé`);
      else if (!droitsService.couvre(affEval.get(String(id)) || [], objet)) problemes.push(`${nom(id)} n'est pas évaluateur sur la zone de ce centre`);
    }
    if (superviseur) {
      const u = parId.get(String(superviseur));
      if (!u) problemes.push(`superviseur introuvable (${superviseur})`);
      else if (!u.actif) problemes.push(`${nom(superviseur)} : compte désactivé`);
      else if (!droitsService.couvre(affSup.get(String(superviseur)) || [], objet)) problemes.push(`${nom(superviseur)} n'est pas superviseur ni coordonnateur sur la zone de ce centre`);
      if (evaluateurs.some((e) => String(e) === String(superviseur))) problemes.push('le superviseur ne peut pas être aussi évaluateur');
    }
    return problemes;
  };
};

/**
 * Personnes pouvant intervenir dans une campagne : affectations EVALUATEUR / SUPERVISEUR / COORDONNATEUR
 * nationales, sur la zone de la campagne, au-dessus ou en dessous.
 * Renvoie { evaluateurs: [...], superviseurs: [...] } avec, pour chacun, ses zones d'intervention.
 */
const intervenantsPour = async (campagne) => {
  const filtreZone = {};
  if (campagne.zone) {
    const zone = await Zone.findById(campagne.zone).select('ancetres').lean();
    const sousZones = await Zone.find({ ancetres: campagne.zone }).distinct('_id');
    filtreZone.$or = [
      { zone: null, centre: null },
      { zone: { $in: [...(zone?.ancetres || []), campagne.zone, ...sousZones] } },
    ];
  }
  const affectations = await Affectation.find({
    role: { $in: [...ROLES_EVALUATION, ...ROLES_SUPERVISION] }, ...droitsService.conditionsActives(), ...filtreZone,
  }).populate('utilisateur', 'nom prenom telephone actif').populate('zone', 'nom code').populate('centre', 'nom').lean();

  const groupes = { evaluateurs: new Map(), superviseurs: new Map() };
  for (const a of affectations) {
    if (!a.utilisateur?.actif) continue;
    const groupe = ROLES_EVALUATION.includes(a.role) ? groupes.evaluateurs : groupes.superviseurs;
    const id = String(a.utilisateur._id);
    const entree = groupe.get(id) || { ...a.utilisateur, perimetres: [] };
    entree.perimetres.push(a.centre?.nom || a.zone?.nom || 'National');
    groupe.set(id, entree);
  }
  const trier = (m) => [...m.values()].sort((x, y) => `${x.nom} ${x.prenom}`.localeCompare(`${y.nom} ${y.prenom}`, 'fr'));
  return { evaluateurs: trier(groupes.evaluateurs), superviseurs: trier(groupes.superviseurs) };
};

module.exports = { preparerVerification, intervenantsPour };
