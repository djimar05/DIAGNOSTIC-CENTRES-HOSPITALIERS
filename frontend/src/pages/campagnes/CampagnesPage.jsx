import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  Badge, Button, Card, Center, Group, Loader, Progress, SegmentedControl, SimpleGrid, Stack, Text, Title,
} from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useCampagnes } from '../../api/campagnes';
import { useAuth } from '../../auth/AuthProvider';
import EnTetePage from '../../composants/EnTetePage';
import { ROLES_GESTION_CAMPAGNE, STATUTS_CAMPAGNE } from '../../constantes/planification';
import { messageErreur } from '../../utils/erreurs';
import { formatDate } from '../../utils/format';

const FILTRES = [
  { value: '', label: 'Toutes' },
  { value: 'PREPARATION', label: 'En préparation' },
  { value: 'EN_COURS', label: 'En cours' },
  { value: 'CLOTUREE', label: 'Clôturées' },
];

function CarteCampagne({ campagne }) {
  const navigate = useNavigate();
  const { total, validees, parStatut } = campagne.avancement;
  const annulees = parStatut.ANNULEE || 0;
  const taux = total - annulees ? Math.round((validees / (total - annulees)) * 100) : 0;
  const statut = STATUTS_CAMPAGNE[campagne.statut];
  return (
    <Card withBorder style={{ cursor: 'pointer' }} onClick={() => navigate(`/campagnes/${campagne._id}`)}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Title order={4} lineClamp={2}>{campagne.nom}</Title>
        <Badge color={statut.couleur} variant="light" style={{ flexShrink: 0 }}>{statut.libelle}</Badge>
      </Group>
      <Text size="sm" c="dimmed" mt={4}>{campagne.zone?.nom || 'National'} · {campagne.grille ? `${campagne.grille.code} v${campagne.grille.version}` : ''}</Text>
      <Text size="xs" c="dimmed">
        {campagne.dateDebut ? `Du ${formatDate(campagne.dateDebut)}` : 'Dates à définir'}{campagne.dateFin ? ` au ${formatDate(campagne.dateFin)}` : ''}
      </Text>
      <Group justify="space-between" mt="md" mb={4}>
        <Text size="sm">{total} centre(s)</Text>
        <Text size="sm" fw={600}>{validees} validé(s) · {taux} %</Text>
      </Group>
      <Progress value={taux} color="teal" size="sm" />
    </Card>
  );
}

/** W7 – Campagnes visibles (selon le profil et le périmètre). */
export default function CampagnesPage() {
  const { aLeRole } = useAuth();
  const [params, setParams] = useSearchParams();
  const statut = params.get('statut') || '';
  const { data: campagnes = [], isPending, error } = useCampagnes({ statut });

  return (
    <Stack maw={1200}>
      <EnTetePage titre="Campagnes" sousTitre="Opérations de diagnostic : une mission par centre à visiter">
        {aLeRole(...ROLES_GESTION_CAMPAGNE) && (
          <Button component={Link} to="/campagnes/nouvelle" leftSection={<IconPlus size={16} />}>Nouvelle campagne</Button>
        )}
      </EnTetePage>
      <SegmentedControl data={FILTRES} value={statut} onChange={(v) => setParams(v ? { statut: v } : {}, { replace: true })} style={{ alignSelf: 'flex-start' }} />

      {isPending ? (
        <Center p="xl"><Loader /></Center>
      ) : error ? (
        <Text c="red">{messageErreur(error)}</Text>
      ) : campagnes.length === 0 ? (
        <Card withBorder><Text c="dimmed">Aucune campagne{statut ? ' dans cet état' : ''}.</Text></Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {campagnes.map((c) => <CarteCampagne key={c._id} campagne={c} />)}
        </SimpleGrid>
      )}
    </Stack>
  );
}
