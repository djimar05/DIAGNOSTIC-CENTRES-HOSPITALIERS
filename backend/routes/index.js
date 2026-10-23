/**
 * Table de montage des routes de l'API (sous /api).
 * `publique: true` : pas de connexion exigée par index.js (les routes de /auth protègent elles-mêmes ce qui doit l'être).
 * Utilisée par index.js et par scripts/testDocumentation.js (chaque route doit être documentée).
 */
module.exports = [
  { prefixe: '/auth', routeur: require('./authRoutes'), publique: true },
  { prefixe: '/utilisateurs', routeur: require('./utilisateurRoutes') },
  { prefixe: '/affectations', routeur: require('./affectationRoutes') },
  { prefixe: '/journal', routeur: require('./journalRoutes') },
  { prefixe: '/zones', routeur: require('./zoneRoutes') },
  { prefixe: '/centres', routeur: require('./centreRoutes') },
  { prefixe: '/grilles', routeur: require('./grilleRoutes') },
  { prefixe: '/campagnes', routeur: require('./campagneRoutes') },
  { prefixe: '/missions', routeur: require('./missionRoutes') },
  { prefixe: '/mobile', routeur: require('./mobileRoutes') },
  { prefixe: '/evaluations', routeur: require('./evaluationRoutes') },
  { prefixe: '/fichiers', routeur: require('./fichierRoutes') },
];
