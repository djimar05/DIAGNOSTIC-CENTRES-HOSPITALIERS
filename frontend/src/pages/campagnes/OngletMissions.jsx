import { useMemo, useState } from 'react';
import {
  ActionIcon, Badge, Button, Card, Center, Checkbox, Group, Loader, Menu, SegmentedControl, Table, Text,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconDots, IconPlayerPlay, IconTrash, IconUsersGroup, IconX } from '@tabler/icons-react';
import { useModifierMission, useSupprimerMission } from '../../api/campagnes';
import { STATUTS_EVALUATION, estEnRetard, nomsEquipe } from '../../constantes/planification';
import { COULEURS_CLASSES } from '../../constantes/referentiel';
import { notifierErreur, notifierSucces } from '../../utils/erreurs';
import { formatDate } from '../../utils/format';

const FILTRES = [
  { value: 'toutes', label: 'Toutes' },
  { value: 'sansEquipe', label: 'Sans équipe' },
  { value: 'sansDate', label: 'Sans date' },
  { value: 'enRetard', label: 'En retard' },
  { value: 'aValider', label: 'À valider' },
];

const filtrer = (missions, filtre) => missions.filter((m) => {
  const active = m.statut !== 'ANNULEE';
  switch (filtre) {
    case 'sansEquipe': return active && !m.evaluateurs.length;
    case 'sansDate': return active && !m.datePrevue;
    case 'enRetard': return estEnRetard(m);
    case 'aValider': return m.evaluation?.statut === 'SOUMISE';
    default: return true;
  }
});

/** W8 – Missions de la campagne : équipe, date, statut ; affectation groupée. */
export default function OngletMissions({ missions, chargement, gestion, cloturee, onEquipe }) {
  const [filtre, setFiltre] = useState('toutes');
  const [selection, setSelection] = useState([]);
  const modifier = useModifierMission();
  const supprimer = useSupprimerMission();

  const affichees = useMemo(() => filtrer(missions, filtre), [missions, filtre]);
  const selectionnables = affichees.filter((m) => m.statut !== 'ANNULEE');
  const toutesCochees = selectionnables.length > 0 && selectionnables.every((m) => selection.includes(m._id));
  const basculer = (id) => setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const editable = gestion && !cloturee;

  const changerStatut = (m, statut) => modals.openConfirmModal({
    title: statut === 'ANNULEE' ? `Annuler la visite de ${m.centre.nom} ?` : `Réactiver la visite de ${m.centre.nom} ?`,
    children: <Text size="sm">{statut === 'ANNULEE' ? 'L\'évaluation sera annulée. Vous pourrez réactiver la mission tant que la campagne n\'est pas clôturée.' : 'L\'évaluation repasse en « planifiée ».'}</Text>,
    labels: { confirm: statut === 'ANNULEE' ? 'Annuler la visite' : 'Réactiver', cancel: 'Retour' },
    confirmProps: { color: statut === 'ANNULEE' ? 'red' : 'teal' },
    onConfirm: () => modifier.mutate({ id: m._id, statut }, { onSuccess: () => notifierSucces('Mission mise à jour'), onError: (e) => notifierErreur(e) }),
  });
  const retirer = (m) => modals.openConfirmModal({
    title: `Retirer ${m.centre.nom} de la campagne ?`,
    children: <Text size="sm">La mission et son évaluation (pas encore commencée) seront supprimées.</Text>,
    labels: { confirm: 'Retirer', cancel: 'Retour' },
    confirmProps: { color: 'red' },
    onConfirm: () => supprimer.mutate(m._id, { onSuccess: () => notifierSucces('Centre retiré'), onError: (e) => notifierErreur(e) }),
  });

  if (chargement) return <Center p="xl"><Loader /></Center>;

  return (
    <Card withBorder p={0}>
      <Group justify="space-between" p="sm">
        <SegmentedControl size="xs" data={FILTRES} value={filtre} onChange={(f) => { setFiltre(f); setSelection([]); }} />
        {editable && selection.length > 0 && (
          <Button size="xs" leftSection={<IconUsersGroup size={14} />} onClick={() => onEquipe(missions.filter((m) => selection.includes(m._id)))}>
            Équipe / date pour {selection.length} mission(s)
          </Button>
        )}
      </Group>
      {affichees.length === 0 ? (
        <Text c="dimmed" size="sm" p="md">Aucune mission dans cette catégorie.</Text>
      ) : (
        <Table.ScrollContainer minWidth={900}>
          <Table highlightOnHover verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                {editable && <Table.Th w={40}><Checkbox checked={toutesCochees} onChange={() => setSelection(toutesCochees ? [] : selectionnables.map((m) => m._id))} aria-label="Tout sélectionner" /></Table.Th>}
                <Table.Th>Centre</Table.Th><Table.Th>Zone</Table.Th><Table.Th>Visite prévue</Table.Th>
                <Table.Th>Évaluateurs</Table.Th><Table.Th>Superviseur</Table.Th><Table.Th>Évaluation</Table.Th>
                {editable && <Table.Th aria-label="Actions" />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {affichees.map((m) => {
                const annulee = m.statut === 'ANNULEE';
                const statut = STATUTS_EVALUATION[m.evaluation?.statut || 'PLANIFIEE'];
                const retard = estEnRetard(m);
                return (
                  <Table.Tr key={m._id} style={{ opacity: annulee ? 0.55 : 1 }}>
                    {editable && <Table.Td><Checkbox checked={selection.includes(m._id)} disabled={annulee} onChange={() => basculer(m._id)} aria-label={m.centre.nom} /></Table.Td>}
                    <Table.Td>
                      <Text size="sm">{m.centre.nom}</Text>
                      <Text size="xs" c="dimmed" ff="monospace">{m.centre.code}</Text>
                    </Table.Td>
                    <Table.Td><Text size="sm">{m.centre.zone?.nom}</Text></Table.Td>
                    <Table.Td>
                      {m.datePrevue ? <Text size="sm" c={retard ? 'red' : undefined} fw={retard ? 600 : undefined}>{formatDate(m.datePrevue)}{retard ? ' · en retard' : ''}</Text>
                        : <Text size="sm" c="orange">À planifier</Text>}
                    </Table.Td>
                    <Table.Td>{m.evaluateurs.length ? <Text size="sm">{nomsEquipe(m.evaluateurs)}</Text> : <Badge color="orange" variant="light">Sans équipe</Badge>}</Table.Td>
                    <Table.Td><Text size="sm">{m.superviseur ? nomsEquipe([m.superviseur]) : '—'}</Text></Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Badge color={statut.couleur} variant="light">{statut.libelle}</Badge>
                        {m.evaluation?.classe && <Badge color={COULEURS_CLASSES[m.evaluation.classe]}>{m.evaluation.classe}</Badge>}
                      </Group>
                    </Table.Td>
                    {editable && (
                      <Table.Td>
                        <Menu position="bottom-end">
                          <Menu.Target><ActionIcon variant="subtle" aria-label="Actions"><IconDots size={16} /></ActionIcon></Menu.Target>
                          <Menu.Dropdown>
                            {!annulee && <Menu.Item leftSection={<IconUsersGroup size={16} />} onClick={() => onEquipe([m])}>Équipe et date</Menu.Item>}
                            {!annulee && ['PLANIFIEE', 'EN_COURS'].includes(m.evaluation?.statut) && (
                              <Menu.Item leftSection={<IconX size={16} />} color="orange" onClick={() => changerStatut(m, 'ANNULEE')}>Annuler la visite</Menu.Item>
                            )}
                            {annulee && <Menu.Item leftSection={<IconPlayerPlay size={16} />} onClick={() => changerStatut(m, 'A_FAIRE')}>Réactiver</Menu.Item>}
                            {m.evaluation?.statut === 'PLANIFIEE' && !annulee && (
                              <Menu.Item leftSection={<IconTrash size={16} />} color="red" onClick={() => retirer(m)}>Retirer de la campagne</Menu.Item>
                            )}
                          </Menu.Dropdown>
                        </Menu>
                      </Table.Td>
                    )}
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Card>
  );
}
