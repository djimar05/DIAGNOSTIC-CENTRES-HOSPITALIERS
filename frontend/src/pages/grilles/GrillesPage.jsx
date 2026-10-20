import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Badge, Button, Card, Center, Group, Loader, Stack, Table, Text, Title } from '@mantine/core';
import { IconFileImport, IconPlus } from '@tabler/icons-react';
import { useGrilles } from '../../api/grilles';
import EnTetePage from '../../composants/EnTetePage';
import { STATUTS_GRILLE } from '../../constantes/grilles';
import { LIBELLES_NIVEAUX_CENTRE } from '../../constantes/referentiel';
import { messageErreur } from '../../utils/erreurs';
import { formatDate } from '../../utils/format';
import ModaleImportGrille from './ModaleImportGrille';
import ModaleNouvelleGrille from './ModaleNouvelleGrille';

/** W6 – Grilles d'évaluation, regroupées par code avec toutes leurs versions. */
export default function GrillesPage() {
  const navigate = useNavigate();
  const { data: grilles = [], isPending, error } = useGrilles();
  const [modale, setModale] = useState(null); // 'nouvelle' | 'import'

  const parCode = useMemo(() => {
    const groupes = new Map();
    grilles.forEach((g) => groupes.set(g.code, [...(groupes.get(g.code) || []), g]));
    return [...groupes.entries()];
  }, [grilles]);

  return (
    <Stack maw={1200}>
      <EnTetePage titre="Grilles d'évaluation" sousTitre="Une grille publiée est figée : toute modification passe par une nouvelle version">
        <Button variant="default" leftSection={<IconFileImport size={16} />} onClick={() => setModale('import')}>Importer</Button>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setModale('nouvelle')}>Nouvelle grille</Button>
      </EnTetePage>

      {isPending ? (
        <Center p="xl"><Loader /></Center>
      ) : error ? (
        <Text c="red">{messageErreur(error)}</Text>
      ) : parCode.length === 0 ? (
        <Card withBorder><Text c="dimmed">Aucune grille. Importez la grille officielle ou créez-en une.</Text></Card>
      ) : parCode.map(([code, versions]) => (
        <Card key={code} withBorder p={0}>
          <Group justify="space-between" p="md" pb="xs">
            <div>
              <Title order={4}>{versions[0].nom}</Title>
              <Text size="xs" c="dimmed" ff="monospace">{code}</Text>
            </div>
            <Group gap={4}>
              {versions[0].niveauxCibles.map((n) => <Badge key={n} variant="outline" color="gray" size="sm">{LIBELLES_NIVEAUX_CENTRE[n]}</Badge>)}
            </Group>
          </Group>
          <Table.ScrollContainer minWidth={640}>
            <Table highlightOnHover verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Version</Table.Th><Table.Th>Statut</Table.Th><Table.Th>Domaines</Table.Th>
                  <Table.Th>Critères</Table.Th><Table.Th>Poids</Table.Th><Table.Th>Publiée le</Table.Th><Table.Th>Modifiée le</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {versions.map((g) => (
                  <Table.Tr key={g._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/grilles/${g._id}`)}>
                    <Table.Td><Text size="sm" fw={600}>v{g.version}</Text></Table.Td>
                    <Table.Td><Badge color={STATUTS_GRILLE[g.statut].couleur} variant="light">{STATUTS_GRILLE[g.statut].libelle}</Badge></Table.Td>
                    <Table.Td><Text size="sm">{g.nbDomaines}</Text></Table.Td>
                    <Table.Td><Text size="sm">{g.nbCriteres}</Text></Table.Td>
                    <Table.Td><Text size="sm" c={g.totalPoids === 100 ? undefined : 'orange'}>{g.totalPoids} %</Text></Table.Td>
                    <Table.Td><Text size="sm">{formatDate(g.publieeLe)}</Text></Table.Td>
                    <Table.Td><Text size="sm">{formatDate(g.updatedAt)}</Text></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      ))}

      <ModaleNouvelleGrille ouvert={modale === 'nouvelle'} onFermer={() => setModale(null)} onCree={(g) => navigate(`/grilles/${g._id}`)} />
      <ModaleImportGrille ouvert={modale === 'import'} onFermer={() => setModale(null)} onImportee={(g) => navigate(`/grilles/${g._id}`)} />
    </Stack>
  );
}
