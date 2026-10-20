import { Navigate, useNavigate } from 'react-router';
import { Alert, Anchor, Center, Paper, Stack, Text, Title } from '@mantine/core';
import { IconShieldLock } from '@tabler/icons-react';
import { useAuth } from '../../auth/AuthProvider';
import FormulaireMotDePasse from '../../composants/FormulaireMotDePasse';
import { notifierSucces } from '../../utils/erreurs';

/** Première connexion ou mot de passe réinitialisé : choix obligatoire d'un mot de passe personnel. */
export default function ChangerMotDePassePage() {
  const { utilisateur, deconnecter } = useAuth();
  const navigate = useNavigate();

  if (!utilisateur.motDePasseAChanger) return <Navigate to="/profil" replace />;

  return (
    <Center mih="100vh" p="md" bg="var(--mantine-color-gray-0)">
      <Paper withBorder shadow="sm" radius="md" p="xl" w="100%" maw={420}>
        <Stack>
          <Title order={2} ta="center">Choisissez votre mot de passe</Title>
          <Alert icon={<IconShieldLock />} color="brand">
            Bonjour {utilisateur.prenom || utilisateur.nom}, vous utilisez un mot de passe temporaire.
            Choisissez-en un personnel pour continuer.
          </Alert>
          <FormulaireMotDePasse
            libelleAncien="Mot de passe temporaire"
            libelleBouton="Enregistrer et continuer"
            onSucces={() => {
              notifierSucces('Mot de passe enregistré');
              navigate('/', { replace: true });
            }}
          />
          <Text size="xs" ta="center">
            <Anchor component="button" type="button" size="xs" onClick={async () => { await deconnecter(); navigate('/connexion'); }}>
              Se déconnecter
            </Anchor>
          </Text>
        </Stack>
      </Paper>
    </Center>
  );
}
