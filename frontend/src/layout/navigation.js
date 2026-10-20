import { IconHistory, IconHome, IconUsers } from '@tabler/icons-react';

/**
 * Entrées du menu latéral. `roles` absent = visible par tous.
 * Les mêmes rôles protègent la route correspondante (voir router.jsx).
 */
export const NAVIGATION = [
  { libelle: 'Accueil', chemin: '/', icone: IconHome },
  { libelle: 'Utilisateurs', chemin: '/utilisateurs', icone: IconUsers, roles: ['ADMINISTRATEUR', 'COORDONNATEUR'] },
  { libelle: "Journal d'activité", chemin: '/journal', icone: IconHistory, roles: ['ADMINISTRATEUR'] },
];

export const rolesDe = (chemin) => NAVIGATION.find((e) => e.chemin === chemin)?.roles;
