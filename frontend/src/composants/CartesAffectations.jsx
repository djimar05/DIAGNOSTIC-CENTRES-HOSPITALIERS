import { Card, Group, SimpleGrid, Text } from '@mantine/core';
import { IconMapPin } from '@tabler/icons-react';
import { libellePerimetre } from '../constantes/roles';
import { formatDate } from '../utils/format';
import { BadgeRole } from './BadgesRoles';

/** Affectations actives de l'utilisateur connecté, en cartes (accueil, profil). */
export default function CartesAffectations({ affectations }) {
  if (!affectations.length) {
    return (
      <Text c="dimmed">
        Aucune affectation active : vous n'avez accès à aucun module. Contactez votre administrateur.
      </Text>
    );
  }
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }}>
      {affectations.map((a) => (
        <Card key={a._id} withBorder radius="md">
          <Group justify="space-between" wrap="nowrap">
            <BadgeRole role={a.role} />
            {a.dateFin && <Text size="xs" c="dimmed">jusqu'au {formatDate(a.dateFin)}</Text>}
          </Group>
          <Group gap={6} mt="sm" wrap="nowrap">
            <IconMapPin size={16} />
            <Text size="sm">{libellePerimetre(a)}</Text>
          </Group>
        </Card>
      ))}
    </SimpleGrid>
  );
}
