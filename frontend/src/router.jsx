import { lazy } from 'react';
import { createBrowserRouter } from 'react-router';
import RouteProtegee, { CHEMIN_MOT_DE_PASSE_TEMPORAIRE } from './auth/RouteProtegee';
import AppLayout from './layout/AppLayout';
import { rolesDe } from './layout/navigation';
import AccueilPage from './pages/AccueilPage';
import ConnexionPage from './pages/ConnexionPage';
import ChangerMotDePassePage from './pages/compte/ChangerMotDePassePage';
import MotDePasseOubliePage from './pages/compte/MotDePasseOubliePage';
import { PageErreur, PageIntrouvable } from './pages/PagesSimples';

// Écrans chargés à la demande : la page de connexion reste légère (réseau lent)
const ProfilPage = lazy(() => import('./pages/compte/ProfilPage'));
const UtilisateursPage = lazy(() => import('./pages/utilisateurs/UtilisateursPage'));
const FicheUtilisateurPage = lazy(() => import('./pages/utilisateurs/FicheUtilisateurPage'));
const JournalPage = lazy(() => import('./pages/journal/JournalPage'));

export const router = createBrowserRouter([
  { path: '/connexion', element: <ConnexionPage />, errorElement: <PageErreur /> },
  { path: '/mot-de-passe-oublie', element: <MotDePasseOubliePage />, errorElement: <PageErreur /> },
  {
    element: <RouteProtegee />,
    errorElement: <PageErreur />,
    children: [
      { path: CHEMIN_MOT_DE_PASSE_TEMPORAIRE, element: <ChangerMotDePassePage /> },
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <AccueilPage /> },
          { path: 'profil', element: <ProfilPage /> },
          {
            element: <RouteProtegee roles={rolesDe('/utilisateurs')} />,
            children: [
              { path: 'utilisateurs', element: <UtilisateursPage /> },
              { path: 'utilisateurs/:id', element: <FicheUtilisateurPage /> },
            ],
          },
          {
            element: <RouteProtegee roles={rolesDe('/journal')} />,
            children: [{ path: 'journal', element: <JournalPage /> }],
          },
          { path: '*', element: <PageIntrouvable /> },
        ],
      },
    ],
  },
]);
