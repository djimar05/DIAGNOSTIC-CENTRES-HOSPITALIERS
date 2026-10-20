import { useMemo } from 'react';
import { Select } from '@mantine/core';
import { useZones } from '../api/referentiel';
import { LIBELLES_NIVEAUX_ZONE, NIVEAUX_ZONE } from '../constantes/referentiel';

const GROUPES = {
  NATIONAL: 'National', REGION: 'Régions', DISTRICT: 'Districts', ZONE_RESPONSABILITE: 'Zones de responsabilité',
};

/**
 * Choix d'une zone du périmètre, groupées par niveau, avec recherche.
 * `niveaux` limite les niveaux proposés ; `exclure(zone)` masque certaines zones.
 */
export default function SelectZone({ niveaux = NIVEAUX_ZONE, exclure, ...props }) {
  const { data: zones = [], isPending } = useZones();

  const donnees = useMemo(() => niveaux
    .map((niveau) => ({
      group: GROUPES[niveau] || LIBELLES_NIVEAUX_ZONE[niveau],
      items: zones
        .filter((z) => z.niveau === niveau && !(exclure && exclure(z)))
        .map((z) => ({ value: z._id, label: `${z.nom} (${z.code})${z.actif === false ? ' – inactive' : ''}` })),
    }))
    .filter((g) => g.items.length), [zones, niveaux, exclure]);

  return (
    <Select
      searchable
      nothingFoundMessage="Aucune zone"
      placeholder={isPending ? 'Chargement…' : 'Rechercher une zone'}
      data={donnees}
      {...props}
    />
  );
}
