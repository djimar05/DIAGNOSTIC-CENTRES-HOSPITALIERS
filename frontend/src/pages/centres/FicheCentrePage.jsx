import { useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  Anchor, Badge, Breadcrumbs, Button, Card, Center, Group, Loader, SimpleGrid, Stack, Table, Tabs, Text, Title,
} from '@mantine/core';
import { IconChecklist, IconEdit, IconInfoCircle, IconMapPin, IconReportMedical } from '@tabler/icons-react';
import { useActionsCentre, useCentre, useEvaluationsCentre } from '../../api/referentiel';
import { useAuth } from '../../auth/AuthProvider';
import {
  COULEURS_CLASSES, LIBELLES_NIVEAUX_CENTRE, LIBELLES_PRIORITES, LIBELLES_STATUTS_ACTION,
  LIBELLES_STATUTS_EVALUATION, LIBELLES_STATUTS_JURIDIQUES,
} from '../../constantes/referentiel';
import { messageErreur } from '../../utils/erreurs';
import { formatDate } from '../../utils/format';
import ModaleCentre from './ModaleCentre';

function Info({ libelle, children }) {
  return (
    <div>
      <Text size="xs" c="dimmed">{libelle}</Text>
      <Text size="sm">{children ?? '—'}</Text>
    </div>
  );
}

const nombre = (n) => (n === undefined || n === null ? null : n.toLocaleString('fr-FR'));

function OngletEvaluations({ centreId }) {
  const { data = [], isPending, error } = useEvaluationsCentre(centreId);
  if (isPending) return <Center p="md"><Loader size="sm" /></Center>;
  if (error) return <Text c="red">{messageErreur(error)}</Text>;
  if (!data.length) return <Text c="dimmed" size="sm">Aucune évaluation pour ce centre. Elles apparaîtront ici après les premières missions.</Text>;
  return (
    <Table.ScrollContainer minWidth={600}>
      <Table verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr><Table.Th>Campagne</Table.Th><Table.Th>Date</Table.Th><Table.Th>Statut</Table.Th><Table.Th>Score</Table.Th></Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.map((e) => (
            <Table.Tr key={e._id}>
              <Table.Td><Text size="sm">{e.campagne?.nom || '—'}</Text></Table.Td>
              <Table.Td><Text size="sm">{formatDate(e.debut || e.createdAt)}</Text></Table.Td>
              <Table.Td><Badge variant="light">{LIBELLES_STATUTS_EVALUATION[e.statut]}</Badge></Table.Td>
              <Table.Td>
                {e.scores?.classe ? (
                  <Group gap={6}><Badge color={COULEURS_CLASSES[e.scores.classe]}>{e.scores.classe}</Badge><Text size="sm">{Math.round(e.scores.global)}/100</Text></Group>
                ) : <Text size="sm" c="dimmed">—</Text>}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

function OngletActions({ centreId }) {
  const { data = [], isPending, error } = useActionsCentre(centreId);
  if (isPending) return <Center p="md"><Loader size="sm" /></Center>;
  if (error) return <Text c="red">{messageErreur(error)}</Text>;
  if (!data.length) return <Text c="dimmed" size="sm">Aucune action corrective. Elles seront créées à partir des écarts relevés lors des évaluations.</Text>;
  return (
    <Table.ScrollContainer minWidth={640}>
      <Table verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr><Table.Th>Action</Table.Th><Table.Th>Critère</Table.Th><Table.Th>Priorité</Table.Th><Table.Th>Échéance</Table.Th><Table.Th>Statut</Table.Th></Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.map((a) => (
            <Table.Tr key={a._id}>
              <Table.Td><Text size="sm">{a.actionPrevue}</Text></Table.Td>
              <Table.Td><Text size="sm" ff="monospace">{a.critereCode || '—'}</Text></Table.Td>
              <Table.Td><Text size="sm">{LIBELLES_PRIORITES[a.priorite]}</Text></Table.Td>
              <Table.Td><Text size="sm">{formatDate(a.echeance)}</Text></Table.Td>
              <Table.Td><Badge variant="light">{LIBELLES_STATUTS_ACTION[a.statut]} {a.avancement ? `· ${a.avancement} %` : ''}</Badge></Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

/** W5 – Fiche d'un centre : informations, évaluations, actions correctives. */
export default function FicheCentrePage() {
  const { id } = useParams();
  const { aLeRole } = useAuth();
  const estAdmin = aLeRole('ADMINISTRATEUR');
  const voitLeDetail = aLeRole('ADMINISTRATEUR', 'RESPONSABLE_NATIONAL', 'COORDONNATEUR', 'EVALUATEUR', 'SUPERVISEUR', 'RESPONSABLE_CENTRE');
  const { data: centre, isPending, error } = useCentre(id);
  const [onglet, setOnglet] = useState('infos');
  const [modification, setModification] = useState(false);

  if (isPending) return <Center p="xl"><Loader /></Center>;
  if (error) return <Text c="red">{messageErreur(error)}</Text>;

  const [lng, lat] = centre.gps?.coordinates || [];
  const chemin = centre.zoneAncetres?.filter((z) => z.niveau !== 'NATIONAL').map((z) => z.nom).join(' › ');

  return (
    <Stack maw={1100}>
      <Breadcrumbs>
        <Anchor component={Link} to="/centres" size="sm">Centres</Anchor>
        <Text size="sm">{centre.nom}</Text>
      </Breadcrumbs>

      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>{centre.nom}</Title>
          <Group gap={6} mt={4}>
            <Text size="sm" c="dimmed" ff="monospace">{centre.code}</Text>
            <Badge variant="light">{LIBELLES_NIVEAUX_CENTRE[centre.niveau]}</Badge>
            {centre.actif ? <Badge color="teal" variant="dot">Actif</Badge> : <Badge color="gray" variant="dot">Inactif</Badge>}
            {centre.derniereEvaluation?.classe && (
              <Badge color={COULEURS_CLASSES[centre.derniereEvaluation.classe]}>
                Classe {centre.derniereEvaluation.classe} · {Math.round(centre.derniereEvaluation.score)}/100
              </Badge>
            )}
          </Group>
          {chemin && <Text size="sm" c="dimmed" mt={4}>{chemin}</Text>}
        </div>
        {estAdmin && (
          <Button variant="default" leftSection={<IconEdit size={16} />} onClick={() => setModification(true)}>Modifier</Button>
        )}
      </Group>

      <Tabs value={onglet} onChange={setOnglet} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="infos" leftSection={<IconInfoCircle size={16} />}>Informations</Tabs.Tab>
          {voitLeDetail && <Tabs.Tab value="evaluations" leftSection={<IconReportMedical size={16} />}>Évaluations</Tabs.Tab>}
          {voitLeDetail && <Tabs.Tab value="actions" leftSection={<IconChecklist size={16} />}>Actions correctives</Tabs.Tab>}
        </Tabs.List>

        <Tabs.Panel value="infos" pt="md">
          <Card withBorder>
            <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
              <Info libelle="Statut juridique">{LIBELLES_STATUTS_JURIDIQUES[centre.statutJuridique]}</Info>
              <Info libelle="Zone de rattachement">{centre.zone?.nom}</Info>
              <Info libelle="Localité">{centre.localite}</Info>
              <Info libelle="Position GPS">
                {lng !== undefined ? (
                  <Anchor href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`} target="_blank" rel="noopener noreferrer" size="sm">
                    <Group gap={4} component="span"><IconMapPin size={14} />{lat.toFixed(4)}, {lng.toFixed(4)}</Group>
                  </Anchor>
                ) : null}
              </Info>
              <Info libelle="Population desservie">{nombre(centre.populationDesservie)}</Info>
              <Info libelle="Nombre de lits">{nombre(centre.nombreLits)}</Info>
              <Info libelle="Responsable">{centre.responsable?.nom}</Info>
              <Info libelle="Téléphone du responsable">{centre.responsable?.telephone}</Info>
            </SimpleGrid>
            <Text size="xs" c="dimmed" mt="md">Services disponibles</Text>
            {centre.services?.length ? (
              <Group gap={6} mt={4}>{centre.services.map((s) => <Badge key={s} variant="outline" color="gray">{s.replace(/_/g, ' ').toLowerCase()}</Badge>)}</Group>
            ) : <Text size="sm">—</Text>}
          </Card>
        </Tabs.Panel>
        {voitLeDetail && (
          <>
            <Tabs.Panel value="evaluations" pt="md"><Card withBorder><OngletEvaluations centreId={id} /></Card></Tabs.Panel>
            <Tabs.Panel value="actions" pt="md"><Card withBorder><OngletActions centreId={id} /></Card></Tabs.Panel>
          </>
        )}
      </Tabs>

      {estAdmin && <ModaleCentre ouvert={modification} onFermer={() => setModification(false)} centre={centre} />}
    </Stack>
  );
}
