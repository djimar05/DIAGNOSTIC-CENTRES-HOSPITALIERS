import { Link, isRouteErrorResponse, useRouteError } from 'react-router';
import { Alert, Button, Center, Stack, Text, Title } from '@mantine/core';
import { IconTools } from '@tabler/icons-react';

/** Écran prévu au plan de travail mais pas encore réalisé. */
export function EnConstructionPage({ titre }) {
  return (
    <Stack maw={600}>
      <Title order={2}>{titre}</Title>
      <Alert icon={<IconTools />} title="Écran en construction">
        Cet écran sera disponible dans une prochaine version.
      </Alert>
    </Stack>
  );
}

export function PageIntrouvable() {
  return (
    <Center mih="60vh" p="md">
      <Stack align="center">
        <Title order={1}>404</Title>
        <Text c="dimmed">Cette page n'existe pas.</Text>
        <Button component={Link} to="/">Retour à l'accueil</Button>
      </Stack>
    </Center>
  );
}

/** Erreur inattendue pendant l'affichage d'une page. */
export function PageErreur() {
  const erreur = useRouteError();
  if (isRouteErrorResponse(erreur) && erreur.status === 404) return <PageIntrouvable />;
  return (
    <Center mih="60vh" p="md">
      <Stack align="center" maw={480}>
        <Title order={2}>Une erreur est survenue</Title>
        <Text c="dimmed" ta="center">Rechargez la page. Si le problème persiste, contactez l'administrateur.</Text>
        <Button onClick={() => window.location.reload()}>Recharger</Button>
      </Stack>
    </Center>
  );
}
