import {
  IconBuildingHospital, IconCalendarEvent, IconClipboardList, IconHistory, IconHome, IconSitemap, IconUsers,
} from '@tabler/icons-react';
import { ROLES_LECTURE_CAMPAGNE } from '../constantes/planification';

/**
 * Entrées du menu latéral. `roles` absent = visible par tous.
 * Les mêmes rôles protègent la route correspondante (voir router.jsx).
 */
export const NAVIGATION = [
  { libelle: 'Accueil', chemin: '/', icone: IconHome },
  { libelle: 'Campagnes', chemin: '/campagnes', icone: IconCalendarEvent, roles: ROLES_LECTURE_CAMPAGNE },
  { libelle: 'Centres', chemin: '/centres', icone: IconBuildingHospital },
  { libelle: 'Zones', chemin: '/zones', icone: IconSitemap, roles: ['ADMINISTRATEUR'] },
  { libelle: 'Grilles', chemin: '/grilles', icone: IconClipboardList, roles: ['ADMINISTRATEUR'] },
  { libelle: 'Utilisateurs', chemin: '/utilisateurs', icone: IconUsers, roles: ['ADMINISTRATEUR', 'COORDONNATEUR'] },
  { libelle: "Journal d'activité", chemin: '/journal', icone: IconHistory, roles: ['ADMINISTRATEUR'] },
];

export const rolesDe = (chemin) => NAVIGATION.find((e) => e.chemin === chemin)?.roles;
