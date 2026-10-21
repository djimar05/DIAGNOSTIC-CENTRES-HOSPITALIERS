import { Card, Center, Group, Loader, Progress, SimpleGrid, Stack, Table, Text, Title, Tooltip } from '@mantine/core';
import { useAvancement } from '../../api/campagnes';
import { ORDRE_STATUTS_EVALUATION, STATUTS_EVALUATION } from '../../constantes/planification';
import { messageErreur } from '../../utils/erreurs';

function Indicateur({ libelle, valeur, couleur, aide }) {
  return (
    <Tooltip label={aide} disabled={!aide} multiline w={240}>
      <Card withBorder padding="sm">
        <Text size="xs" c="dimmed">{libelle}</Text>
        <Text fz={28} fw={700} c={valeur ? couleur : 'dimmed'} lh={1.2}>{valeur}</Text>
      </Card>
    </Tooltip>
  );
}

/** W8 – Avancement : où en sont les visites, ce qui bloque, détail par zone. */
export default function OngletAvancement({ campagneId }) {
  const { data: a, isPending, error } = useAvancement(campagneId);
  if (isPending) return <Center p="xl"><Loader /></Center>;
  if (error) return <Text c="red">{messageErreur(error)}</Text>;
  if (!a.total) return <Card withBorder><Text c="dimmed">Aucun centre dans cette campagne (ou dans votre périmètre).</Text></Card>;

  return (
    <Stack>
      <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }}>
        <Indicateur libelle="Centres" valeur={a.total} couleur="dark" />
        <Indicateur libelle="Taux de validation" valeur={`${a.tauxValidation} %`} couleur="teal" aide="Évaluations validées ou publiées, sur les centres non annulés" />
        <Indicateur libelle="À valider" valeur={a.soumises} couleur="violet" aide="Évaluations soumises, en attente du superviseur" />
        <Indicateur libelle="En retard" valeur={a.enRetard} couleur="red" aide="Date de visite passée, évaluation pas encore soumise" />
        <Indicateur libelle="Sans équipe" valeur={a.sansEquipe} couleur="orange" aide="Aucun évaluateur affecté" />
        <Indicateur libelle="Sans date" valeur={a.sansDate} couleur="orange" aide="Date de visite à planifier" />
      </SimpleGrid>

      <Card withBorder>
        <Title order={5} mb="sm">Évaluations par statut</Title>
        <Progress.Root size={24}>
          {ORDRE_STATUTS_EVALUATION.filter((s) => a.parStatut[s]).map((s) => (
            <Tooltip key={s} label={`${STATUTS_EVALUATION[s].libelle} : ${a.parStatut[s]}`}>
              <Progress.Section value={(a.parStatut[s] / a.total) * 100} color={STATUTS_EVALUATION[s].couleur}>
                <Progress.Label>{a.parStatut[s]}</Progress.Label>
              </Progress.Section>
            </Tooltip>
          ))}
        </Progress.Root>
        <Group gap="md" mt="sm">
          {ORDRE_STATUTS_EVALUATION.filter((s) => a.parStatut[s]).map((s) => (
            <Group key={s} gap={6}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: `var(--mantine-color-${STATUTS_EVALUATION[s].couleur}-6)` }} />
              <Text size="xs">{STATUTS_EVALUATION[s].libelle} ({a.parStatut[s]})</Text>
            </Group>
          ))}
        </Group>
      </Card>

      <Card withBorder p={0}>
        <Title order={5} p="md" pb={0}>Par zone</Title>
        <Table.ScrollContainer minWidth={520}>
          <Table verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr><Table.Th>Zone</Table.Th><Table.Th>Centres</Table.Th><Table.Th>Validés</Table.Th><Table.Th>En retard</Table.Th><Table.Th w="30%">Progression</Table.Th></Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {a.parZone.map((z) => {
                const base = z.total - z.annulees;
                const taux = base ? Math.round((z.validees / base) * 100) : 0;
                return (
                  <Table.Tr key={z.zone?._id || 'aucune'}>
                    <Table.Td><Text size="sm">{z.zone?.nom || '—'}</Text></Table.Td>
                    <Table.Td><Text size="sm">{z.total}</Text></Table.Td>
                    <Table.Td><Text size="sm">{z.validees}</Text></Table.Td>
                    <Table.Td><Text size="sm" c={z.enRetard ? 'red' : undefined}>{z.enRetard}</Text></Table.Td>
                    <Table.Td><Group gap="xs" wrap="nowrap"><Progress value={taux} color="teal" style={{ flex: 1 }} /><Text size="xs" w={36}>{taux} %</Text></Group></Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
    </Stack>
  );
}
