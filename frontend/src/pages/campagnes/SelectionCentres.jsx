import { useMemo, useState } from 'react';
import { Badge, Card, Center, Checkbox, Group, Loader, ScrollArea, Table, Text, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useCentres } from '../../api/referentiel';
import { LIBELLES_NIVEAUX_CENTRE } from '../../constantes/referentiel';
import { normaliserRecherche } from '../../utils/format';

/**
 * Choix des centres d'une campagne : centres actifs de la zone, des niveaux visés par la grille.
 * `exclus` : centres déjà dans la campagne (affichés mais non sélectionnables).
 */
export default function SelectionCentres({ zone, niveaux = [], valeur, onChange, exclus = [] }) {
  const { data, isPending } = useCentres({ zone: zone || '', actif: 'true', limite: 200 });
  const [recherche, setRecherche] = useState('');

  const centres = useMemo(() => (data?.data || []).filter((c) => !niveaux.length || niveaux.includes(c.niveau)), [data, niveaux]);
  const horsNiveau = (data?.data?.length || 0) - centres.length;
  const terme = normaliserRecherche(recherche);
  const affiches = centres.filter((c) => !terme || normaliserRecherche(`${c.nom} ${c.code} ${c.zone?.nom} ${c.localite}`).includes(terme));
  const selectionnables = affiches.filter((c) => !exclus.includes(c._id));
  const tousCoches = selectionnables.length > 0 && selectionnables.every((c) => valeur.includes(c._id));

  const basculer = (id) => onChange(valeur.includes(id) ? valeur.filter((v) => v !== id) : [...valeur, id]);
  const basculerTous = () => onChange(tousCoches
    ? valeur.filter((v) => !selectionnables.some((c) => c._id === v))
    : [...new Set([...valeur, ...selectionnables.map((c) => c._id)])]);

  if (isPending) return <Center p="lg"><Loader /></Center>;

  return (
    <Card withBorder p={0}>
      <Group justify="space-between" p="sm">
        <TextInput placeholder="Filtrer (nom, code, district…)" leftSection={<IconSearch size={16} />} value={recherche} onChange={(e) => setRecherche(e.currentTarget.value)} w={280} />
        <Group gap="xs">
          <Badge size="lg" variant="light">{valeur.length} sélectionné(s)</Badge>
          {horsNiveau > 0 && <Text size="xs" c="dimmed">{horsNiveau} centre(s) d'un autre niveau masqué(s)</Text>}
        </Group>
      </Group>
      {centres.length === 0 ? (
        <Text c="dimmed" size="sm" p="md">Aucun centre actif de ce niveau dans cette zone.</Text>
      ) : (
        <ScrollArea.Autosize mah={420}>
          <Table highlightOnHover stickyHeader>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={40}><Checkbox checked={tousCoches} indeterminate={!tousCoches && selectionnables.some((c) => valeur.includes(c._id))} onChange={basculerTous} aria-label="Tout sélectionner" /></Table.Th>
                <Table.Th>Centre</Table.Th><Table.Th>Niveau</Table.Th><Table.Th>Zone</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {affiches.map((c) => {
                const exclu = exclus.includes(c._id);
                return (
                  <Table.Tr key={c._id} style={{ cursor: exclu ? 'default' : 'pointer', opacity: exclu ? 0.5 : 1 }} onClick={() => !exclu && basculer(c._id)}>
                    <Table.Td><Checkbox checked={exclu || valeur.includes(c._id)} disabled={exclu} onChange={() => {}} aria-label={c.nom} /></Table.Td>
                    <Table.Td>
                      <Text size="sm">{c.nom}</Text>
                      <Text size="xs" c="dimmed" ff="monospace">{c.code}{exclu ? ' · déjà dans la campagne' : ''}</Text>
                    </Table.Td>
                    <Table.Td><Text size="sm">{LIBELLES_NIVEAUX_CENTRE[c.niveau]}</Text></Table.Td>
                    <Table.Td><Text size="sm">{c.zone?.nom}</Text></Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea.Autosize>
      )}
      {data?.pagination?.total > 200 && (
        <Text size="xs" c="orange" p="sm">Plus de 200 centres dans cette zone : choisissez une zone plus précise.</Text>
      )}
    </Card>
  );
}
