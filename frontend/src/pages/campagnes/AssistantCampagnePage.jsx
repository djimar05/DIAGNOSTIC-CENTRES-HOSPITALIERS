import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Alert, Anchor, Breadcrumbs, Button, Card, Group, List, Select, SimpleGrid, Stack, Stepper, Text, TextInput, Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle } from '@tabler/icons-react';
import { useAjouterMissions, useCreerCampagne, useIntervenants } from '../../api/campagnes';
import { useGrilles } from '../../api/grilles';
import { useZones } from '../../api/referentiel';
import { useAuth } from '../../auth/AuthProvider';
import EnTetePage from '../../composants/EnTetePage';
import SelectZone from '../../composants/SelectZone';
import { LIBELLES_NIVEAUX_CENTRE } from '../../constantes/referentiel';
import { messageErreur } from '../../utils/erreurs';
import { formatDate } from '../../utils/format';
import ChampsEquipe from './ChampsEquipe';
import SelectionCentres from './SelectionCentres';

const INITIAL = {
  nom: '', description: '', partenaire: '', dateDebut: '', dateFin: '',
  grille: null, zone: null, centres: [], evaluateurs: [], superviseur: null, datePrevue: '',
};

function Ligne({ libelle, children }) {
  return (
    <Group gap="xs" wrap="nowrap" align="flex-start">
      <Text size="sm" c="dimmed" w={160} style={{ flexShrink: 0 }}>{libelle}</Text>
      <Text size="sm">{children || '—'}</Text>
    </Group>
  );
}

/**
 * W7 – Assistant de création : informations → grille et zone → centres → équipe → récapitulatif.
 * La campagne est créée en préparation ; tout reste modifiable avant le démarrage.
 */
export default function AssistantCampagnePage() {
  const navigate = useNavigate();
  const { aLeRole } = useAuth();
  const estAdmin = aLeRole('ADMINISTRATEUR');
  const [etape, setEtape] = useState(0);
  const [v, setV] = useState(INITIAL);
  const [erreur, setErreur] = useState(null);
  // Si l'ajout des centres échoue après la création, un nouvel essai ne recrée pas la campagne
  const [campagneCreee, setCampagneCreee] = useState(null);
  const changer = (modif) => setV((avant) => ({ ...avant, ...modif }));

  const { data: grilles = [] } = useGrilles({ statut: 'PUBLIEE' });
  const { data: zones = [] } = useZones();
  const { data: intervenants, isPending: chargementIntervenants } = useIntervenants({ zone: v.zone }, { enabled: etape >= 3 });
  const creer = useCreerCampagne();
  const ajouter = useAjouterMissions();

  const grille = grilles.find((g) => g._id === v.grille);
  const zone = zones.find((z) => z._id === v.zone);
  const niveaux = grille?.niveauxCibles || [];

  const erreursEtape = [
    !v.nom.trim() ? 'Donnez un nom à la campagne' : (v.dateDebut && v.dateFin && v.dateFin < v.dateDebut ? 'La date de fin doit suivre la date de début' : null),
    !v.grille ? 'Choisissez une grille publiée' : (!v.zone && !estAdmin ? 'Choisissez la zone de la campagne' : null),
    !v.centres.length ? 'Sélectionnez au moins un centre' : null,
    null,
  ];
  const suivant = () => {
    if (erreursEtape[etape]) { setErreur(erreursEtape[etape]); return; }
    setErreur(null);
    setEtape((e) => e + 1);
  };

  const valider = async () => {
    setErreur(null);
    try {
      const campagne = campagneCreee || await creer.mutateAsync({
        nom: v.nom.trim(), description: v.description.trim() || undefined, partenaire: v.partenaire.trim() || undefined,
        dateDebut: v.dateDebut || undefined, dateFin: v.dateFin || undefined, grille: v.grille, zone: v.zone || undefined,
      });
      setCampagneCreee(campagne);
      const r = await ajouter.mutateAsync({
        id: campagne._id, centres: v.centres, evaluateurs: v.evaluateurs, superviseur: v.superviseur || undefined, datePrevue: v.datePrevue || undefined,
      });
      const remarques = [...r.refus.map((x) => `${x.code || x.centre} : ${x.motif}`), ...r.avertissements];
      notifications.show({
        color: remarques.length ? 'orange' : 'teal',
        autoClose: remarques.length ? false : 5000,
        title: `Campagne créée avec ${r.creees} centre(s)`,
        message: remarques.length ? remarques.join(' · ') : 'Vérifiez les équipes puis démarrez la campagne.',
      });
      navigate(`/campagnes/${campagne._id}`, { replace: true });
    } catch (err) {
      setErreur(messageErreur(err));
    }
  };

  return (
    <Stack maw={1000}>
      <Breadcrumbs>
        <Anchor component={Link} to="/campagnes" size="sm">Campagnes</Anchor>
        <Text size="sm">Nouvelle campagne</Text>
      </Breadcrumbs>
      <EnTetePage titre="Nouvelle campagne" />

      <Stepper active={etape} onStepClick={(i) => i < etape && setEtape(i)} size="sm">
        <Stepper.Step label="Informations" />
        <Stepper.Step label="Grille et zone" />
        <Stepper.Step label="Centres" />
        <Stepper.Step label="Équipe" description="facultatif" />
        <Stepper.Step label="Récapitulatif" />
      </Stepper>

      {erreur && <Alert color="red" icon={<IconAlertCircle />}>{erreur}</Alert>}

      <Card withBorder>
        {etape === 0 && (
          <Stack>
            <TextInput label="Nom" withAsterisk placeholder="Diagnostic 2026 – District A" value={v.nom} onChange={(e) => changer({ nom: e.currentTarget.value })} data-autofocus />
            <Textarea label="Description" autosize minRows={2} value={v.description} onChange={(e) => changer({ description: e.currentTarget.value })} />
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <TextInput type="date" label="Début" value={v.dateDebut} onChange={(e) => changer({ dateDebut: e.currentTarget.value })} />
              <TextInput type="date" label="Fin" value={v.dateFin} onChange={(e) => changer({ dateFin: e.currentTarget.value })} />
              <TextInput label="Partenaire / financeur" placeholder="Facultatif" value={v.partenaire} onChange={(e) => changer({ partenaire: e.currentTarget.value })} />
            </SimpleGrid>
          </Stack>
        )}

        {etape === 1 && (
          <Stack>
            <Select
              label="Grille d'évaluation"
              description="Seules les grilles publiées sont proposées"
              withAsterisk
              data={grilles.map((g) => ({ value: g._id, label: `${g.nom} (${g.code} v${g.version})` }))}
              value={v.grille}
              onChange={(grilleId) => changer({ grille: grilleId, centres: [] })}
              nothingFoundMessage="Aucune grille publiée"
            />
            {grille && <Text size="sm" c="dimmed">Centres visés : {grille.niveauxCibles.map((n) => LIBELLES_NIVEAUX_CENTRE[n]).join(', ') || 'tous niveaux'}</Text>}
            <SelectZone
              label="Zone de la campagne"
              description={estAdmin ? 'Laissez vide pour une campagne nationale' : 'Votre zone ou une zone qui en dépend'}
              withAsterisk={!estAdmin}
              clearable={estAdmin}
              value={v.zone}
              onChange={(zoneId) => changer({ zone: zoneId, centres: [], evaluateurs: [], superviseur: null })}
            />
          </Stack>
        )}

        {etape === 2 && (
          <Stack>
            <Text size="sm">
              Centres actifs de <b>{zone?.nom || 'tout le pays'}</b> visés par la grille. Chaque centre sélectionné devient une mission.
            </Text>
            <SelectionCentres zone={v.zone} niveaux={niveaux} valeur={v.centres} onChange={(centres) => changer({ centres })} />
          </Stack>
        )}

        {etape === 3 && (
          <Stack>
            <Text size="sm">
              Équipe par défaut pour les {v.centres.length} centre(s). Vous pourrez l'ajuster centre par centre ensuite.
              Une équipe est obligatoire sur chaque centre pour démarrer la campagne.
            </Text>
            <ChampsEquipe
              intervenants={intervenants}
              chargement={chargementIntervenants}
              evaluateurs={v.evaluateurs}
              superviseur={v.superviseur}
              onChange={changer}
            />
            <TextInput type="date" label="Date de visite prévue" description="Facultatif, commune à tous les centres" w={240} value={v.datePrevue} onChange={(e) => changer({ datePrevue: e.currentTarget.value })} />
          </Stack>
        )}

        {etape === 4 && (
          <Stack gap="xs">
            <Ligne libelle="Nom">{v.nom}</Ligne>
            <Ligne libelle="Période">{v.dateDebut ? `${formatDate(v.dateDebut)} → ${v.dateFin ? formatDate(v.dateFin) : '…'}` : null}</Ligne>
            <Ligne libelle="Grille">{grille && `${grille.nom} (v${grille.version})`}</Ligne>
            <Ligne libelle="Zone">{zone?.nom || 'National'}</Ligne>
            <Ligne libelle="Centres">{v.centres.length}</Ligne>
            <Ligne libelle="Évaluateurs">
              {v.evaluateurs.length
                ? intervenants?.evaluateurs.filter((u) => v.evaluateurs.includes(u._id)).map((u) => `${u.prenom || ''} ${u.nom}`.trim()).join(', ')
                : 'À affecter plus tard'}
            </Ligne>
            <Ligne libelle="Superviseur">{intervenants?.superviseurs.find((u) => u._id === v.superviseur)?.nom}</Ligne>
            <Ligne libelle="Visite prévue">{v.datePrevue && formatDate(v.datePrevue)}</Ligne>
            <Alert mt="sm" variant="light">
              <List size="sm">
                <List.Item>La campagne est créée <b>en préparation</b> : rien n'est encore envoyé aux évaluateurs.</List.Item>
                <List.Item>Une évaluation est préparée pour chaque centre, avec la grille choisie.</List.Item>
              </List>
            </Alert>
          </Stack>
        )}
      </Card>

      <Group justify="space-between">
        <Button variant="default" onClick={() => (etape ? setEtape(etape - 1) : navigate('/campagnes'))}>{etape ? 'Précédent' : 'Annuler'}</Button>
        {etape < 4
          ? <Button onClick={suivant}>Suivant</Button>
          : <Button color="teal" onClick={valider} loading={creer.isPending || ajouter.isPending}>Créer la campagne</Button>}
      </Group>
    </Stack>
  );
}
