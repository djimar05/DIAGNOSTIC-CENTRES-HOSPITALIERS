import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  ActionIcon, Badge, Box, Button, Card, Center, Group, Loader, Stack, Text, TextInput, Tooltip, UnstyledButton,
} from '@mantine/core';
import {
  IconBuildingHospital, IconChevronDown, IconChevronRight, IconEdit, IconPlus, IconSearch,
} from '@tabler/icons-react';
import { useArbreZones } from '../../api/referentiel';
import EnTetePage from '../../composants/EnTetePage';
import { LIBELLES_NIVEAUX_ZONE, niveauEnfant } from '../../constantes/referentiel';
import { messageErreur } from '../../utils/erreurs';
import { normaliserRecherche } from '../../utils/format';
import ModaleZone from './ModaleZone';

const COULEURS_NIVEAUX = { NATIONAL: 'dark', REGION: 'indigo', DISTRICT: 'teal', ZONE_RESPONSABILITE: 'gray' };

/** Garde les branches dont un nœud correspond à la recherche (nom ou code). */
const filtrerArbre = (noeuds, terme) => noeuds.flatMap((n) => {
  const enfants = filtrerArbre(n.enfants, terme);
  const correspond = normaliserRecherche(`${n.nom} ${n.code}`).includes(terme);
  return correspond || enfants.length ? [{ ...n, enfants: correspond ? n.enfants : enfants }] : [];
});

function NoeudZone({ noeud, profondeur, ouverts, basculer, onAjouter, onModifier, rechercheActive }) {
  const ouvert = rechercheActive || ouverts.has(noeud._id);
  const sousNiveau = niveauEnfant(noeud.niveau);

  return (
    <>
      <Group
        gap="xs"
        wrap="nowrap"
        py={6}
        pr="sm"
        pl={`calc(${profondeur} * var(--mantine-spacing-lg) + var(--mantine-spacing-xs))`}
        style={{ borderBottom: '1px solid var(--mantine-color-gray-2)', opacity: noeud.actif ? 1 : 0.55 }}
      >
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          onClick={() => basculer(noeud._id)}
          disabled={!noeud.enfants.length}
          aria-label={ouvert ? 'Replier' : 'Déplier'}
          style={{ visibility: noeud.enfants.length ? 'visible' : 'hidden' }}
        >
          {ouvert ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
        </ActionIcon>

        <UnstyledButton onClick={() => basculer(noeud._id)} style={{ flex: 1, minWidth: 0 }}>
          <Group gap="xs" wrap="nowrap">
            <Text size="sm" fw={500} truncate>{noeud.nom}</Text>
            <Text size="xs" c="dimmed" ff="monospace">{noeud.code}</Text>
            {!noeud.actif && <Badge size="xs" color="gray">Inactive</Badge>}
          </Group>
        </UnstyledButton>

        <Badge size="sm" variant="light" color={COULEURS_NIVEAUX[noeud.niveau]} visibleFrom="sm">
          {LIBELLES_NIVEAUX_ZONE[noeud.niveau]}
        </Badge>
        <Tooltip label={`${noeud.nbCentres} rattaché(s) directement · ${noeud.nbCentresTotal} au total`}>
          <Badge
            size="sm"
            variant="outline"
            color="gray"
            leftSection={<IconBuildingHospital size={12} />}
            component={Link}
            to={`/centres?zone=${noeud._id}`}
            style={{ cursor: 'pointer' }}
          >
            {noeud.nbCentresTotal}
          </Badge>
        </Tooltip>

        {onModifier && (
          <Group gap={2} wrap="nowrap">
            <Tooltip label={sousNiveau ? `Ajouter : ${LIBELLES_NIVEAUX_ZONE[sousNiveau]}` : 'Dernier niveau'}>
              <ActionIcon variant="subtle" onClick={() => onAjouter(noeud)} disabled={!sousNiveau} aria-label="Ajouter une sous-zone">
                <IconPlus size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Modifier / déplacer">
              <ActionIcon variant="subtle" onClick={() => onModifier(noeud)} aria-label="Modifier">
                <IconEdit size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        )}
      </Group>

      {ouvert && noeud.enfants.map((enfant) => (
        <NoeudZone
          key={enfant._id}
          noeud={enfant}
          profondeur={profondeur + 1}
          ouverts={ouverts}
          basculer={basculer}
          onAjouter={onAjouter}
          onModifier={onModifier}
          rechercheActive={rechercheActive}
        />
      ))}
    </>
  );
}

/** W4 – Découpage sanitaire : arbre National → Région → District → Zone de responsabilité. */
export default function ZonesPage() {
  const { data: racines = [], isPending, error } = useArbreZones();
  const [recherche, setRecherche] = useState('');
  const [ouverts, setOuverts] = useState(() => new Set());
  const [modale, setModale] = useState(null); // { zone } | { parent, niveau }

  // Au premier chargement, le niveau national et les régions sont dépliés
  const [initialise, setInitialise] = useState(false);
  if (!initialise && racines.length) {
    setOuverts(new Set(racines.map((r) => r._id)));
    setInitialise(true);
  }

  const basculer = (id) => setOuverts((avant) => {
    const suivant = new Set(avant);
    if (suivant.has(id)) suivant.delete(id); else suivant.add(id);
    return suivant;
  });

  const terme = normaliserRecherche(recherche.trim());
  const affichees = useMemo(() => (terme ? filtrerArbre(racines, terme) : racines), [racines, terme]);
  const aucuneZone = !isPending && !error && racines.length === 0;

  return (
    <Stack maw={1000}>
      <EnTetePage titre="Zones" sousTitre="Découpage sanitaire : national, régions, districts, zones de responsabilité">
        {aucuneZone && (
          <Button leftSection={<IconPlus size={16} />} onClick={() => setModale({ niveau: 'NATIONAL' })}>Créer le niveau national</Button>
        )}
      </EnTetePage>

      <TextInput
        placeholder="Rechercher une zone (nom ou code)"
        leftSection={<IconSearch size={16} />}
        value={recherche}
        onChange={(e) => setRecherche(e.currentTarget.value)}
        maw={360}
      />

      <Card withBorder p={0}>
        {isPending ? (
          <Center p="xl"><Loader /></Center>
        ) : error ? (
          <Text c="red" p="md">{messageErreur(error)}</Text>
        ) : aucuneZone ? (
          <Text c="dimmed" p="md">Aucune zone. Commencez par créer le niveau national.</Text>
        ) : affichees.length === 0 ? (
          <Text c="dimmed" p="md">Aucune zone ne correspond à « {recherche} ».</Text>
        ) : (
          <Box>
            {affichees.map((racine) => (
              <NoeudZone
                key={racine._id}
                noeud={racine}
                profondeur={0}
                ouverts={ouverts}
                basculer={basculer}
                onAjouter={(parent) => setModale({ parent, niveau: niveauEnfant(parent.niveau) })}
                onModifier={(zone) => setModale({ zone })}
                rechercheActive={Boolean(terme)}
              />
            ))}
          </Box>
        )}
      </Card>
      <Text size="xs" c="dimmed">
        Le nombre à droite de chaque zone indique ses centres (sous-zones comprises) ; cliquez dessus pour les voir.
      </Text>

      <ModaleZone
        ouvert={Boolean(modale)}
        onFermer={() => setModale(null)}
        zone={modale?.zone}
        parent={modale?.parent}
        niveau={modale?.niveau}
      />
    </Stack>
  );
}
