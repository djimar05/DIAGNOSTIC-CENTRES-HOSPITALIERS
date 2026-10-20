import { useEffect } from 'react';
import {
  ActionIcon, Alert, Button, Checkbox, Divider, Group, Modal, NumberInput, Select, SimpleGrid, Stack, Text, TextInput, Textarea,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconInfoCircle, IconPlus, IconTrash } from '@tabler/icons-react';
import {
  LIBELLES_PREUVES, LIBELLES_TYPES_REPONSE, TYPES_A_OPTIONS, TYPES_NON_NOTES,
} from '../../constantes/grilles';
import { options as versOptions } from '../../constantes/referentiel';

const VIDE = {
  code: '', libelle: '', aide: '', typeReponse: 'OUI_NON', pointsMax: 1, poids: 1,
  obligatoire: true, eliminatoire: false, sansObjetAutorise: false, preuveExigee: 'AUCUNE',
  options: [], seuils: [], conditionCritere: null, conditionValeur: '',
};

const versFormulaire = (c) => ({
  ...VIDE,
  ...c,
  aide: c.aide || '',
  options: (c.options || []).map((o) => ({ code: o.code, libelle: o.libelle || '', points: o.points ?? 0 })),
  seuils: (c.bareme?.seuils || []).map((s) => ({ min: s.min ?? '', max: s.max ?? '', points: s.points ?? 0 })),
  conditionCritere: c.condition?.critere || null,
  conditionValeur: c.condition?.valeur === undefined || c.condition?.valeur === null ? '' : String(c.condition.valeur),
});

const nombreOuUndefined = (v) => (v === '' || v === null || v === undefined ? undefined : Number(v));

/**
 * Création / modification d'un critère. `autresCriteres` sert au choix de la condition d'affichage
 * et à vérifier que le code est unique dans la grille.
 */
export default function ModaleCritere({ ouvert, onFermer, critere, autresCriteres, onValider }) {
  const form = useForm({
    initialValues: VIDE,
    validate: {
      code: (v) => {
        if (!v.trim()) return 'Obligatoire';
        return autresCriteres.some((c) => c.code === v.trim()) ? 'Ce code existe déjà dans la grille' : null;
      },
      libelle: (v) => (v.trim() ? null : 'Obligatoire'),
      pointsMax: (v, f) => (TYPES_NON_NOTES.includes(f.typeReponse) || v > 0 ? null : 'Doit être supérieur à 0'),
      options: (v, f) => {
        if (!TYPES_A_OPTIONS.includes(f.typeReponse)) return null;
        if (!v.length) return 'Ajoutez au moins une option';
        if (v.some((o) => !o.code.trim())) return 'Chaque option doit avoir un code';
        return new Set(v.map((o) => o.code.trim())).size === v.length ? null : 'Codes d\'options en double';
      },
      conditionValeur: (v, f) => (!f.conditionCritere || String(v).trim() ? null : 'Indiquez la valeur attendue'),
    },
  });
  const v = form.getValues();

  useEffect(() => {
    if (!ouvert) return;
    form.setValues(critere ? versFormulaire(critere) : VIDE);
    form.resetDirty();
  }, [ouvert]); // eslint-disable-line react-hooks/exhaustive-deps

  const soumettre = (f) => {
    const type = f.typeReponse;
    onValider({
      ...(critere?._id && { _id: critere._id }),
      code: f.code.trim(),
      libelle: f.libelle.trim(),
      aide: f.aide.trim() || undefined,
      typeReponse: type,
      pointsMax: TYPES_NON_NOTES.includes(type) ? 0 : Number(f.pointsMax),
      poids: Number(f.poids) || 1,
      obligatoire: f.obligatoire,
      eliminatoire: TYPES_NON_NOTES.includes(type) ? false : f.eliminatoire,
      sansObjetAutorise: f.sansObjetAutorise,
      preuveExigee: f.preuveExigee,
      options: TYPES_A_OPTIONS.includes(type)
        ? f.options.map((o) => ({ code: o.code.trim(), libelle: o.libelle.trim() || o.code.trim(), points: Number(o.points) || 0 }))
        : [],
      bareme: { seuils: type === 'NOMBRE' ? f.seuils.map((s) => ({ min: nombreOuUndefined(s.min), max: nombreOuUndefined(s.max), points: Number(s.points) || 0 })) : [] },
      condition: f.conditionCritere ? { critere: f.conditionCritere, valeur: f.conditionValeur.trim() } : undefined,
      ordre: critere?.ordre,
    });
    onFermer();
  };

  const critereCible = autresCriteres.find((c) => c.code === v.conditionCritere);
  const valeursCible = critereCible?.typeReponse === 'OUI_NON' ? ['Oui', 'Non']
    : TYPES_A_OPTIONS.includes(critereCible?.typeReponse) ? critereCible.options.map((o) => o.code) : null;
  const sommeOptions = v.options.reduce((s, o) => s + (Number(o.points) || 0), 0);

  return (
    <Modal opened={ouvert} onClose={onFermer} title={critere ? `Critère ${critere.code}` : 'Nouveau critère'} size="xl">
      <form onSubmit={form.onSubmit(soumettre)} noValidate>
        <Stack>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <TextInput label="Code" withAsterisk placeholder="EAU-01" data-autofocus {...form.getInputProps('code')} />
            <Select label="Type de réponse" data={versOptions(LIBELLES_TYPES_REPONSE)} allowDeselect={false} style={{ gridColumn: 'span 2' }} {...form.getInputProps('typeReponse')} />
          </SimpleGrid>
          <Textarea label="Question" withAsterisk autosize minRows={2} placeholder="Source d'eau potable disponible toute l'année sur le site" {...form.getInputProps('libelle')} />
          <TextInput label="Aide pour l'évaluateur" placeholder="Forage, adduction ou citerne traitée" {...form.getInputProps('aide')} />

          {TYPES_NON_NOTES.includes(v.typeReponse) ? (
            <Alert icon={<IconInfoCircle />} variant="light">Ce type de réponse est informatif : il ne rapporte pas de points.</Alert>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <NumberInput label="Points maximum" min={0} decimalScale={2} {...form.getInputProps('pointsMax')} />
              <NumberInput label="Poids dans le domaine" description="Importance relative du critère" min={0} decimalScale={2} {...form.getInputProps('poids')} />
            </SimpleGrid>
          )}

          {TYPES_A_OPTIONS.includes(v.typeReponse) && (
            <>
              <Divider label="Options de réponse" labelPosition="left" />
              {v.options.map((o, i) => (
                <Group key={i} gap="xs" wrap="nowrap" align="flex-start">
                  <TextInput placeholder="CODE" w={130} {...form.getInputProps(`options.${i}.code`)} aria-label="Code de l'option" />
                  <TextInput placeholder="Libellé affiché" style={{ flex: 1 }} {...form.getInputProps(`options.${i}.libelle`)} aria-label="Libellé" />
                  <NumberInput placeholder="Points" w={90} min={0} {...form.getInputProps(`options.${i}.points`)} aria-label="Points" />
                  <ActionIcon variant="subtle" color="red" mt={6} onClick={() => form.removeListItem('options', i)} aria-label="Supprimer l'option"><IconTrash size={16} /></ActionIcon>
                </Group>
              ))}
              {form.errors.options && <Text size="xs" c="red">{form.errors.options}</Text>}
              <Group justify="space-between">
                <Button variant="light" size="xs" leftSection={<IconPlus size={14} />} onClick={() => form.insertListItem('options', { code: '', libelle: '', points: 0 })}>Ajouter une option</Button>
                {v.typeReponse === 'CHOIX_MULTIPLE' && sommeOptions > v.pointsMax && (
                  <Text size="xs" c="dimmed">Somme des options ({sommeOptions}) plafonnée à {v.pointsMax} points</Text>
                )}
              </Group>
            </>
          )}

          {v.typeReponse === 'NOMBRE' && (
            <>
              <Divider label="Barème (valeur → points)" labelPosition="left" />
              <Text size="xs" c="dimmed" mt={-8}>
                On retient le dernier seuil dont le minimum est atteint. Sans barème, le nombre est relevé mais pas noté.
              </Text>
              {v.seuils.map((s, i) => (
                <Group key={i} gap="xs" wrap="nowrap">
                  <NumberInput placeholder="de" w={110} {...form.getInputProps(`seuils.${i}.min`)} aria-label="Minimum" />
                  <NumberInput placeholder="à (facultatif)" w={130} {...form.getInputProps(`seuils.${i}.max`)} aria-label="Maximum" />
                  <Text size="sm">→</Text>
                  <NumberInput placeholder="points" w={100} min={0} {...form.getInputProps(`seuils.${i}.points`)} aria-label="Points" />
                  <ActionIcon variant="subtle" color="red" onClick={() => form.removeListItem('seuils', i)} aria-label="Supprimer le seuil"><IconTrash size={16} /></ActionIcon>
                </Group>
              ))}
              <Group>
                <Button variant="light" size="xs" leftSection={<IconPlus size={14} />} onClick={() => form.insertListItem('seuils', { min: '', max: '', points: 0 })}>Ajouter un seuil</Button>
              </Group>
            </>
          )}

          <Divider label="Règles" labelPosition="left" />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Checkbox label="Obligatoire" description="Doit être renseigné pour soumettre l'évaluation" {...form.getInputProps('obligatoire', { type: 'checkbox' })} />
            <Checkbox label="« Sans objet » autorisé" description="Exclu du calcul quand il ne s'applique pas au centre" {...form.getInputProps('sansObjetAutorise', { type: 'checkbox' })} />
            <Checkbox
              label="Éliminatoire"
              description="Non satisfait (0 point) → le score du domaine est plafonné"
              disabled={TYPES_NON_NOTES.includes(v.typeReponse)}
              {...form.getInputProps('eliminatoire', { type: 'checkbox' })}
            />
            <Select label="Preuve exigée" data={versOptions(LIBELLES_PREUVES)} allowDeselect={false} {...form.getInputProps('preuveExigee')} />
          </SimpleGrid>

          <Divider label="Condition d'affichage (facultatif)" labelPosition="left" />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select
              label="Afficher seulement si le critère"
              placeholder="Toujours affiché"
              data={autresCriteres.map((c) => ({ value: c.code, label: `${c.code} – ${c.libelle}` }))}
              searchable
              clearable
              {...form.getInputProps('conditionCritere')}
            />
            {valeursCible ? (
              <Select label="a pour réponse" data={valeursCible} disabled={!v.conditionCritere} {...form.getInputProps('conditionValeur')} />
            ) : (
              <TextInput label="a pour réponse" disabled={!v.conditionCritere} {...form.getInputProps('conditionValeur')} />
            )}
          </SimpleGrid>

          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onFermer}>Annuler</Button>
            <Button type="submit">Valider</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
