import { Stack, Text, Title } from '@mantine/core';
import { useAuth } from '../auth/AuthProvider';
import CartesAffectations from '../composants/CartesAffectations';
import { formatDateHeure, nomComplet } from '../utils/format';

export default function AccueilPage() {
  const { utilisateur } = useAuth();

  return (
    <Stack maw={900}>
      <div>
        <Title order={2}>Bonjour, {nomComplet(utilisateur)}</Title>
        {utilisateur.fonction && <Text c="dimmed">{utilisateur.fonction}</Text>}
        {utilisateur.derniereConnexion && (
          <Text size="sm" c="dimmed">Dernière connexion : {formatDateHeure(utilisateur.derniereConnexion)}</Text>
        )}
      </div>

      <Title order={4} mt="md">Vos affectations</Title>
      <CartesAffectations affectations={utilisateur.affectations} />
    </Stack>
  );
}
