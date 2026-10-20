/**
 * Tests du calcul des scores (fonction pure, sans base de données), sur les exemples du cahier des charges.
 * Usage : node scripts/testScore.js
 */
const { calculer, pointsPour, classePour, arrondir } = require('../services/scoreService');

let reussis = 0;
let echoues = 0;

const verifier = (nom, condition, extra = '') => {
  if (condition) {
    reussis++;
    console.log(`  OK   ${nom}`);
  } else {
    echoues++;
    console.log(`  ECHEC ${nom} ${extra}`);
  }
};

const CLASSES = [
  { classe: 'A', min: 80, max: 100 }, { classe: 'B', min: 60, max: 80 },
  { classe: 'C', min: 40, max: 60 }, { classe: 'D', min: 0, max: 40 },
];
const ouiNon = (code, extra = {}) => ({ code, typeReponse: 'OUI_NON', pointsMax: 1, poids: 1, ...extra });
const echelle = (code, extra = {}) => ({ code, typeReponse: 'ECHELLE_0_3', pointsMax: 3, poids: 1, ...extra });
const domaine = (code, poids, criteres, extra = {}) => ({ code, nom: code, poids, plafondSiEliminatoire: 40, criteres, ...extra });
const grille = (domaines) => ({ domaines, classes: CLASSES });
const rep = (critereCode, valeur, extra = {}) => ({ critereCode, valeur, ...extra });
const scoreDomaine = (resultat, code) => resultat.scores.domaines.find((d) => d.domaineCode === code);

// 1. Exemple du cahier : domaine EAU plafonné (score brut 90, ramené à 40 car EAU-01 = Non)
const gEau = grille([domaine('EAU', 100, [ouiNon('EAU-01', { eliminatoire: true }), echelle('EAU-02', { poids: 9 })])]);
let r = calculer({ reponses: [rep('EAU-01', 'Non'), rep('EAU-02', 3)] }, gEau);
let d = scoreDomaine(r, 'EAU');
// (0 × 1 + 1 × 9) / 10 = 90 → plafonné à 40
verifier('éliminatoire non satisfait : score brut 90', d.scoreBrut === 90, `brut=${d.scoreBrut}`);
verifier('éliminatoire non satisfait : domaine plafonné à 40', d.score === 40 && d.plafonne === true, `score=${d.score}`);
verifier('éliminatoire signalé sur le critère', r.criteres.find((c) => c.critereCode === 'EAU-01').eliminatoireNonSatisfait);
r = calculer({ reponses: [rep('EAU-01', 'Oui'), rep('EAU-02', 3)] }, gEau);
verifier('éliminatoire satisfait : pas de plafond', scoreDomaine(r, 'EAU').score === 100 && !scoreDomaine(r, 'EAU').plafonne);
const gBas = grille([domaine('EAU', 100, [ouiNon('EAU-01', { eliminatoire: true }), echelle('EAU-02', { poids: 4 })])]);
r = calculer({ reponses: [rep('EAU-01', 'Non'), rep('EAU-02', 1)] }, gBas);
// (0 + 4 × 1/3) / 5 = 26,7 < 40 : déjà sous le plafond
verifier('éliminatoire sous le plafond : score inchangé', scoreDomaine(r, 'EAU').score === 26.7 && !scoreDomaine(r, 'EAU').plafonne, `score=${scoreDomaine(r, 'EAU').score}`);

// 2. « Sans objet » exclu du dénominateur
const gSO = grille([domaine('SRV', 100, [ouiNon('A'), ouiNon('B'), ouiNon('C', { sansObjetAutorise: true })])]);
r = calculer({ reponses: [rep('A', 'Oui'), rep('B', 'Non'), rep('C', null, { sansObjet: true })] }, gSO);
verifier('sans objet exclu : 1 sur 2 = 50 (et non 33,3)', scoreDomaine(r, 'SRV').score === 50, `score=${scoreDomaine(r, 'SRV').score}`);
verifier('sans objet compté comme répondu', scoreDomaine(r, 'SRV').criteresRepondus === 3 && r.complet);
r = calculer({ reponses: [rep('A', 'Oui'), rep('B', null, { sansObjet: true })] }, gSO);
verifier('sans objet non autorisé : signalé en erreur', r.erreurs.some((e) => e.startsWith('B')));

// 3. Moyenne pondérée des critères
const gPond = grille([domaine('HYG', 100, [echelle('H1', { poids: 2 }), ouiNon('H2')])]);
r = calculer({ reponses: [rep('H1', 2), rep('H2', 'non')] }, gPond);
// (2 × 2/3 + 1 × 0) / 3 = 44,44
verifier('moyenne pondérée : (2 × 2/3 + 0) / 3 = 44,4', scoreDomaine(r, 'HYG').score === 44.4, `score=${scoreDomaine(r, 'HYG').score}`);

// 4. Barème numérique (exemple RH-04 du cahier : % de l'effectif présent → 0 à 3 points)
const rh04 = {
  code: 'RH-04', typeReponse: 'NOMBRE', pointsMax: 3, poids: 2,
  bareme: { seuils: [{ min: 0, max: 49, points: 0 }, { min: 50, max: 74, points: 1 }, { min: 75, max: 89, points: 2 }, { min: 90, max: 100, points: 3 }] },
};
const pts = (v) => pointsPour(rh04, v).points;
verifier('barème : 82 % → 2 points', pts(82) === 2);
verifier('barème : 50 % → 1 point (borne basse incluse)', pts(50) === 1);
verifier('barème : 49,5 % → 0 point (pas de trou entre 49 et 50)', pts(49.5) === 0);
verifier('barème : 95 % → 3 points', pts(95) === 3);
verifier('barème : 120 % (au-delà du dernier seuil) → 3 points', pts(120) === 3);
verifier('barème : valeur sous le premier seuil → 0 point', pts(-5) === 0);
verifier('barème : valeur non numérique → erreur', Boolean(pointsPour(rh04, 'beaucoup').erreur));
r = calculer({ reponses: [rep('RH-04', '82')] }, grille([domaine('RH', 100, [rh04])]));
verifier('barème dans le domaine : 2/3 → 66,7', scoreDomaine(r, 'RH').score === 66.7, `score=${scoreDomaine(r, 'RH').score}`);

// 5. Choix
const electricite = {
  code: 'EAU-03', typeReponse: 'CHOIX_UNIQUE', pointsMax: 3,
  options: [{ code: 'RESEAU', points: 3 }, { code: 'SOLAIRE', points: 2 }, { code: 'AUCUNE', points: 0 }],
};
verifier('choix unique : points de l\'option', pointsPour(electricite, 'SOLAIRE').points === 2);
verifier('choix unique : option inconnue → erreur', Boolean(pointsPour(electricite, 'BOUGIE').erreur));
const services = {
  code: 'SRV-01', typeReponse: 'CHOIX_MULTIPLE', pointsMax: 5,
  options: [{ code: 'A', points: 2 }, { code: 'B', points: 2 }, { code: 'C', points: 2 }],
};
verifier('choix multiple : somme des options', pointsPour(services, ['A', 'B']).points === 4);
verifier('choix multiple : plafonné aux points max (6 → 5)', pointsPour(services, ['A', 'B', 'C']).points === 5);

// 6. Réponses Oui/Non et échelle
verifier('oui/non : « oui », true et « Oui » acceptés', [true, 'oui', 'Oui'].every((v) => pointsPour(ouiNon('X'), v).points === 1));
verifier('oui/non : valeur ambiguë → erreur', Boolean(pointsPour(ouiNon('X'), 'peut-être').erreur));
verifier('échelle 0-3 : 1 → 1/3 des points', pointsPour(echelle('X'), 1).points === 1);
verifier('échelle 0-3 : 4 → erreur', Boolean(pointsPour(echelle('X'), 4).erreur));

// 7. Critère conditionnel (SRV-04 affiché seulement si SRV-03 = Oui)
const gCond = grille([domaine('SRV', 100, [
  ouiNon('SRV-03'),
  ouiNon('SRV-04', { condition: { critere: 'SRV-03', valeur: 'Oui' } }),
])]);
r = calculer({ reponses: [rep('SRV-03', 'Non')] }, gCond);
verifier('condition non remplie : critère sans objet, ni compté ni manquant',
  r.criteres.find((c) => c.critereCode === 'SRV-04').applicable === false && r.complet && scoreDomaine(r, 'SRV').criteresTotal === 1);
r = calculer({ reponses: [rep('SRV-03', true)] }, gCond);
verifier('condition remplie : critère obligatoire et manquant', r.manquants.includes('SRV-04') && !r.complet);

// 8. Critères non notés et réponses manquantes
const gTexte = grille([
  domaine('QUA', 50, [ouiNon('Q1'), { code: 'Q2', typeReponse: 'TEXTE', obligatoire: false }]),
  domaine('NOTE', 50, [{ code: 'N1', typeReponse: 'PHOTO' }]),
]);
r = calculer({ reponses: [rep('Q1', 'Oui'), rep('Q2', 'Difficultés de personnel'), rep('N1', 'photo.jpg')] }, gTexte);
verifier('texte libre : n\'entre pas dans le score', scoreDomaine(r, 'QUA').score === 100);
verifier('domaine sans critère noté : score vide', scoreDomaine(r, 'NOTE').score === null);
verifier('domaine sans score : exclu du global (poids redistribués)', r.scores.global === 100, `global=${r.scores.global}`);
r = calculer({ reponses: [] }, gTexte);
verifier('manquants : obligatoires seulement', r.manquants.join() === 'Q1,N1' && r.scores.global === null, r.manquants.join());

// 9. Score global avec les 10 domaines et les poids du cahier des charges
const POIDS = { INF: 10, EAU: 10, EQU: 12, RH: 12, MED: 12, SRV: 12, HYG: 10, GES: 8, SIS: 7, QUA: 7 };
const VALEURS = { INF: 3, EAU: 2, EQU: 1, RH: 3, MED: 2, SRV: 0, HYG: 3, GES: 1, SIS: 2, QUA: 3 };
const gComplete = grille(Object.entries(POIDS).map(([code, poids]) => domaine(code, poids, [echelle(`${code}-1`)])));
r = calculer({ reponses: Object.entries(VALEURS).map(([code, v]) => rep(`${code}-1`, v)) }, gComplete);
// Σ p × s = 10×100 + 10×66,67 + 12×33,33 + 12×100 + 12×66,67 + 12×0 + 10×100 + 8×33,33 + 7×66,67 + 7×100 = 6500 → 65,0
verifier('global (10 domaines, poids du cahier) = 65,0', r.scores.global === 65, `global=${r.scores.global}`);
verifier('global 65 → classe B', r.scores.classe === 'B');
verifier('scores de domaine arrondis à 1 décimale', scoreDomaine(r, 'EAU').score === 66.7 && scoreDomaine(r, 'EQU').score === 33.3);

// 10. Classes (seuils du cahier) et arrondi
verifier('classe : 80 → A', classePour(80, CLASSES) === 'A');
verifier('classe : 79,9 → B', classePour(79.9, CLASSES) === 'B');
verifier('classe : 60 → B, 59,9 → C', classePour(60, CLASSES) === 'B' && classePour(59.9, CLASSES) === 'C');
verifier('classe : 40 → C, 39,9 → D, 0 → D', classePour(40, CLASSES) === 'C' && classePour(39.9, CLASSES) === 'D' && classePour(0, CLASSES) === 'D');
verifier('classe sur le score affiché : 79,96 → 80,0 → A ; 79,94 → 79,9 → B',
  classePour(arrondir(79.96), CLASSES) === 'A' && classePour(arrondir(79.94), CLASSES) === 'B');
verifier('pas de score → pas de classe', classePour(null, CLASSES) === null);

console.log(`\nRésultat : ${reussis} réussis, ${echoues} échoués`);
process.exit(echoues > 0 ? 1 : 0);
