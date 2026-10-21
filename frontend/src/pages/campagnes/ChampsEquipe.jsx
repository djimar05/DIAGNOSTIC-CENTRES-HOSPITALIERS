import { MultiSelect, Select, SimpleGrid, Text } from '@mantine/core';

const option = (u) => ({
  value: u._id,
  label: `${[u.prenom, u.nom].filter(Boolean).join(' ')} – ${u.perimetres.join(', ')}`,
});

/**
 * Évaluateurs + superviseur, choisis parmi les intervenants possibles (évaluateurs / superviseurs
 * affectés sur la zone). Le superviseur ne peut pas être aussi évaluateur.
 */
export default function ChampsEquipe({ intervenants, evaluateurs, superviseur, onChange, chargement }) {
  const optionsEval = (intervenants?.evaluateurs || []).map(option);
  const optionsSup = (intervenants?.superviseurs || []).filter((u) => !evaluateurs.includes(u._id)).map(option);
  return (
    <>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <MultiSelect
          label="Évaluateurs"
          placeholder={chargement ? 'Chargement…' : 'Choisir'}
          data={optionsEval}
          value={evaluateurs}
          onChange={(v) => onChange({ evaluateurs: v, superviseur: v.includes(superviseur) ? null : superviseur })}
          searchable
          nothingFoundMessage="Aucun évaluateur affecté sur cette zone"
        />
        <Select
          label="Superviseur"
          placeholder={chargement ? 'Chargement…' : 'Choisir (facultatif)'}
          data={optionsSup}
          value={superviseur}
          onChange={(v) => onChange({ evaluateurs, superviseur: v })}
          searchable
          clearable
          nothingFoundMessage="Aucun superviseur affecté sur cette zone"
        />
      </SimpleGrid>
      {intervenants && !intervenants.evaluateurs.length && (
        <Text size="xs" c="orange">
          Aucun évaluateur n'est affecté sur cette zone : donnez d'abord le rôle Évaluateur à des personnes (écran Utilisateurs).
        </Text>
      )}
    </>
  );
}
