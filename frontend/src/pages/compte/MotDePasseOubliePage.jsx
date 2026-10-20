import { Link } from 'react-router';
import { Anchor, Center, List, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconKey } from '@tabler/icons-react';

/**
 * Pas d'envoi automatique pour l'instant (SMS prévu au lot 2) : la réinitialisation passe par
 * l'administrateur, qui fixe un mot de passe temporaire à changer dès la connexion suivante.
 */
export default function MotDePasseOubliePage() {
  return (
    <Center mih="100vh" p="md" bg="var(--mantine-color-gray-0)">
      <Paper withBorder shadow="sm" radius="md" p="xl" w="100%" maw={460}>
        <Stack>
          <Stack gap={4} align="center">
            <ThemeIcon size={48} radius="md"><IconKey size={28} /></ThemeIcon>
            <Title order={2} ta="center">Mot de passe oublié</Title>
          </Stack>
          <Text size="sm">Pour retrouver l'accès à votre compte :</Text>
          <List size="sm" spacing="xs" type="ordered">
            <List.Item>
              Contactez l'administrateur de l'application ou votre coordonnateur, en indiquant le
              numéro de téléphone de votre compte.
            </List.Item>
            <List.Item>Il vous communiquera un mot de passe temporaire.</List.Item>
            <List.Item>
              Connectez-vous avec ce mot de passe : l'application vous demandera aussitôt d'en choisir un nouveau.
            </List.Item>
          </List>
          <Text size="xs" c="dimmed">
            Par sécurité, ne communiquez jamais votre mot de passe, même à l'administrateur.
          </Text>
          <Anchor component={Link} to="/connexion" size="sm" ta="center">Retour à la connexion</Anchor>
        </Stack>
      </Paper>
    </Center>
  );
}
