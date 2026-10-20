import { createBrowserRouter } from 'react-router';
import RouteProtegee from './auth/RouteProtegee';
import AppLayout from './layout/AppLayout';
import { rolesDe } from './layout/navigation';
import AccueilPage from './pages/AccueilPage';
import ConnexionPage from './pages/ConnexionPage';
import { EnConstructionPage, PageErreur, PageIntrouvable } from './pages/PagesSimples';

export const router = createBrowserRouter([
  { path: '/connexion', element: <ConnexionPage />, errorElement: <PageErreur /> },
  {
    element: <RouteProtegee />,
    errorElement: <PageErreur />,
    children: [{
      element: <AppLayout />,
      children: [
        { index: true, element: <AccueilPage /> },
        {
          element: <RouteProtegee roles={rolesDe('/utilisateurs')} />,
          children: [{ path: 'utilisateurs', element: <EnConstructionPage titre="Utilisateurs" /> }],
        },
        {
          element: <RouteProtegee roles={rolesDe('/journal')} />,
          children: [{ path: 'journal', element: <EnConstructionPage titre="Journal d'activité" /> }],
        },
        { path: '*', element: <PageIntrouvable /> },
      ],
    }],
  },
]);
