import { Badge, Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { IconMapPin } from '@tabler/icons-react';
import { useAuth } from '../auth/AuthProvider';
import { libellePerimetre, libelleRole } from '../constantes/roles';

const formatDate = (iso) => (iso
  ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso))
  : null);

export default function AccueilPage() {
  const { utilisateur } = useAuth();
  const { affectations } = utilisateur;

  return (
    <Stack maw={900}>
      <div>
        <Title order={2}>Bonjour, {utilisateur.prenom || utilisateur.nom} {utilisateur.prenom && utilisateur.nom}</Title>
        {utilisateur.fonction && <Text c="dimmed">{utilisateur.fonction}</Text>}
        {utilisateur.derniereConnexion && (
          <Text size="sm" c="dimmed">Dernière connexion : {formatDate(utilisateur.derniereConnexion)}</Text>
        )}
      </div>

      <Title order={4} mt="md">Vos affectations</Title>
      {affectations.length === 0 ? (
        <Text c="dimmed">
          Aucune affectation active : vous n'avez accès à aucun module. Contactez votre administrateur.
        </Text>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          {affectations.map((a) => (
            <Card key={a._id} withBorder radius="md">
              <Group justify="space-between" wrap="nowrap">
                <Badge variant="light">{libelleRole(a.role)}</Badge>
                {a.dateFin && <Text size="xs" c="dimmed">jusqu'au {formatDate(a.dateFin)}</Text>}
              </Group>
              <Group gap={6} mt="sm" wrap="nowrap">
                <IconMapPin size={16} />
                <Text size="sm">{libellePerimetre(a)}</Text>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
