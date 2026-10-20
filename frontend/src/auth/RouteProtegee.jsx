import { Navigate, Outlet, useLocation } from 'react-router';
import { Alert, Button, Center, Loader, Stack } from '@mantine/core';
import { IconWifiOff } from '@tabler/icons-react';
import { useAuth } from './AuthProvider';

export const CHEMIN_MOT_DE_PASSE_TEMPORAIRE = '/changer-mot-de-passe';

/**
 * Réserve les routes enfants aux utilisateurs connectés.
 * `roles` (facultatif) : au moins un de ces rôles est exigé, sinon retour à l'accueil.
 * Un utilisateur au mot de passe temporaire est envoyé vers l'écran de changement.
 */
export default function RouteProtegee({ roles }) {
  const { utilisateur, chargement, erreur, recharger, aLeRole } = useAuth();
  const location = useLocation();

  if (chargement) {
    return <Center h="100vh"><Loader /></Center>;
  }

  // Session présente mais serveur injoignable (coupure réseau) : on propose de réessayer
  if (!utilisateur && erreur && erreur.status !== 401 && erreur.status !== 403) {
    return (
      <Center h="100vh" p="md">
        <Stack maw={420}>
          <Alert color="orange" icon={<IconWifiOff />} title="Serveur injoignable">
            Impossible de joindre le serveur. Vérifiez votre connexion internet.
          </Alert>
          <Button onClick={() => recharger()}>Réessayer</Button>
        </Stack>
      </Center>
    );
  }

  if (!utilisateur) {
    return <Navigate to="/connexion" replace state={{ depuis: location }} />;
  }

  if (utilisateur.motDePasseAChanger && location.pathname !== CHEMIN_MOT_DE_PASSE_TEMPORAIRE) {
    return <Navigate to={CHEMIN_MOT_DE_PASSE_TEMPORAIRE} replace />;
  }

  if (roles && !aLeRole(...roles)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
