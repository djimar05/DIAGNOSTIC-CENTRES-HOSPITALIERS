import { useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  Alert, Anchor, Badge, Breadcrumbs, Button, Center, Group, Loader, Menu, Stack, Tabs, Text, Title,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import {
  IconCalendar, IconChartBar, IconDots, IconEdit, IconFlag, IconList, IconPlayerPlay, IconPlus,
} from '@tabler/icons-react';
import { useCampagne, useCloturerCampagne, useDemarrerCampagne, useMissions } from '../../api/campagnes';
import { useAuth } from '../../auth/AuthProvider';
import { ROLES_GESTION_CAMPAGNE, STATUTS_CAMPAGNE } from '../../constantes/planification';
import { messageErreur, notifierErreur, notifierSucces } from '../../utils/erreurs';
import { formatDate } from '../../utils/format';
import CalendrierMissions from './CalendrierMissions';
import ModaleAjoutCentres from './ModaleAjoutCentres';
import ModaleEquipe from './ModaleEquipe';
import ModaleInfosCampagne from './ModaleInfosCampagne';
import OngletAvancement from './OngletAvancement';
import OngletMissions from './OngletMissions';

/** W8 – Suivi d'une campagne : avancement, missions (équipes), calendrier. */
export default function CampagnePage() {
  const { id } = useParams();
  const { aLeRole } = useAuth();
  const gestion = aLeRole(...ROLES_GESTION_CAMPAGNE);
  const { data: campagne, isPending, error } = useCampagne(id);
  const { data: missions = [], isPending: chargementMissions } = useMissions({ campagne: id }, { enabled: Boolean(campagne) });
  const demarrer = useDemarrerCampagne();
  const cloturer = useCloturerCampagne();
  const [onglet, setOnglet] = useState('avancement');
  const [modale, setModale] = useState(null); // { type: 'equipe', missions } | { type: 'infos' } | { type: 'centres' }

  if (isPending) return <Center p="xl"><Loader /></Center>;
  if (error) return <Text c="red">{messageErreur(error)}</Text>;

  const statut = STATUTS_CAMPAGNE[campagne.statut];
  const cloturee = campagne.statut === 'CLOTUREE';
  const sansEquipe = missions.filter((m) => m.statut !== 'ANNULEE' && !m.evaluateurs.length).length;

  const lancer = () => modals.openConfirmModal({
    title: 'Démarrer la campagne ?',
    children: (
      <Text size="sm">
        Les {missions.length} mission(s) deviennent visibles par les évaluateurs. La grille et la zone seront figées ;
        vous pourrez encore ajouter des centres et ajuster les équipes.
      </Text>
    ),
    labels: { confirm: 'Démarrer', cancel: 'Annuler' },
    confirmProps: { color: 'teal' },
    onConfirm: () => demarrer.mutate(id, { onSuccess: () => notifierSucces('Campagne démarrée'), onError: (e) => notifierErreur(e, 'Démarrage impossible') }),
  });

  const clore = (forcer = false) => cloturer.mutate({ id, forcer }, {
    onSuccess: (r) => notifierSucces(r.evaluationsAnnulees ? `Campagne clôturée (${r.evaluationsAnnulees} évaluation(s) annulée(s))` : 'Campagne clôturée'),
    onError: (e) => {
      if (e.status === 409 && !forcer && e.details) {
        modals.openConfirmModal({
          title: 'Des évaluations ne sont pas terminées',
          children: <Text size="sm">{e.message}. Clôturer quand même ? Elles seront annulées et ne compteront pas dans les résultats.</Text>,
          labels: { confirm: 'Clôturer et annuler', cancel: 'Retour' },
          confirmProps: { color: 'red' },
          onConfirm: () => clore(true),
        });
      } else notifierErreur(e, 'Clôture impossible');
    },
  });
  const confirmerCloture = () => modals.openConfirmModal({
    title: 'Clôturer la campagne ?',
    children: <Text size="sm">La campagne passera en lecture seule. Les résultats validés restent disponibles.</Text>,
    labels: { confirm: 'Clôturer', cancel: 'Annuler' },
    onConfirm: () => clore(false),
  });

  return (
    <Stack maw={1300}>
      <Breadcrumbs>
        <Anchor component={Link} to="/campagnes" size="sm">Campagnes</Anchor>
        <Text size="sm">{campagne.nom}</Text>
      </Breadcrumbs>

      <Group justify="space-between" align="flex-start">
        <div>
          <Group gap="xs">
            <Title order={2}>{campagne.nom}</Title>
            <Badge color={statut.couleur} variant="light" size="lg">{statut.libelle}</Badge>
          </Group>
          <Text size="sm" c="dimmed" mt={4}>
            {campagne.zone?.nom || 'National'} · Grille {campagne.grille?.code} v{campagne.grille?.version}
            {campagne.dateDebut && ` · du ${formatDate(campagne.dateDebut)}`}{campagne.dateFin && ` au ${formatDate(campagne.dateFin)}`}
            {campagne.partenaire && ` · ${campagne.partenaire}`}
          </Text>
          {campagne.description && <Text size="sm" mt={4}>{campagne.description}</Text>}
        </div>
        {gestion && !cloturee && (
          <Group gap="xs">
            <Button variant="default" leftSection={<IconPlus size={16} />} onClick={() => setModale({ type: 'centres' })}>Ajouter des centres</Button>
            {campagne.statut === 'PREPARATION' && (
              <Button color="teal" leftSection={<IconPlayerPlay size={16} />} onClick={lancer} loading={demarrer.isPending}>Démarrer</Button>
            )}
            <Menu position="bottom-end">
              <Menu.Target><Button variant="default" px="xs" aria-label="Autres actions"><IconDots size={18} /></Button></Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconEdit size={16} />} onClick={() => setModale({ type: 'infos' })}>Modifier les informations</Menu.Item>
                {campagne.statut === 'EN_COURS' && <Menu.Item leftSection={<IconFlag size={16} />} onClick={confirmerCloture}>Clôturer la campagne</Menu.Item>}
              </Menu.Dropdown>
            </Menu>
          </Group>
        )}
      </Group>

      {campagne.statut === 'PREPARATION' && gestion && sansEquipe > 0 && (
        <Alert color="orange" variant="light">
          {sansEquipe} mission(s) sans évaluateur : affectez une équipe à chaque centre (onglet Missions) avant de démarrer.
        </Alert>
      )}

      <Tabs value={onglet} onChange={setOnglet} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="avancement" leftSection={<IconChartBar size={16} />}>Avancement</Tabs.Tab>
          <Tabs.Tab value="missions" leftSection={<IconList size={16} />}>Missions ({missions.length})</Tabs.Tab>
          <Tabs.Tab value="calendrier" leftSection={<IconCalendar size={16} />}>Calendrier</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="avancement" pt="md"><OngletAvancement campagneId={id} /></Tabs.Panel>
        <Tabs.Panel value="missions" pt="md">
          <OngletMissions
            missions={missions}
            chargement={chargementMissions}
            gestion={gestion}
            cloturee={cloturee}
            onEquipe={(liste) => setModale({ type: 'equipe', missions: liste })}
          />
        </Tabs.Panel>
        <Tabs.Panel value="calendrier" pt="md">
          {chargementMissions ? <Center p="xl"><Loader /></Center> : (
            <CalendrierMissions missions={missions} onChoisir={gestion && !cloturee ? (m) => setModale({ type: 'equipe', missions: [m] }) : undefined} />
          )}
        </Tabs.Panel>
      </Tabs>

      {gestion && (
        <>
          <ModaleEquipe ouvert={modale?.type === 'equipe'} onFermer={() => setModale(null)} campagneId={id} missions={modale?.missions || []} />
          <ModaleInfosCampagne ouvert={modale?.type === 'infos'} onFermer={() => setModale(null)} campagne={campagne} />
          <ModaleAjoutCentres ouvert={modale?.type === 'centres'} onFermer={() => setModale(null)} campagne={campagne} centresPresents={missions.map((m) => m.centre._id)} />
        </>
      )}
    </Stack>
  );
}
