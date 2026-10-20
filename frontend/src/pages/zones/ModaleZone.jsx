import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Group, Modal, Stack, Switch, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle } from '@tabler/icons-react';
import { useCreerZone, useModifierZone } from '../../api/referentiel';
import SelectZone from '../../composants/SelectZone';
import { LIBELLES_NIVEAUX_ZONE, niveauParent } from '../../constantes/referentiel';
import { messageErreur, notifierSucces } from '../../utils/erreurs';

/**
 * Création d'une sous-zone (`parent` connu, `zone` absente) ou modification d'une zone.
 * En modification, changer le parent déplace la zone et toute sa descendance.
 */
export default function ModaleZone({ ouvert, onFermer, zone, parent, niveau }) {
  const modification = Boolean(zone);
  const creer = useCreerZone();
  const modifier = useModifierZone();
  const mutation = modification ? modifier : creer;
  const [erreur, setErreur] = useState(null);
  const niveauZone = modification ? zone.niveau : niveau;

  const form = useForm({
    initialValues: { code: '', nom: '', parent: null, actif: true },
    validate: {
      code: (v) => (v.trim() ? null : 'Obligatoire'),
      nom: (v) => (v.trim() ? null : 'Obligatoire'),
      parent: (v) => (niveauZone === 'NATIONAL' || v ? null : 'Obligatoire'),
    },
  });

  useEffect(() => {
    if (!ouvert) return;
    setErreur(null);
    form.setValues(modification
      ? { code: zone.code, nom: zone.nom, parent: zone.parent || null, actif: zone.actif }
      : { code: '', nom: '', parent: parent?._id || null, actif: true });
  }, [ouvert]); // eslint-disable-line react-hooks/exhaustive-deps

  // Une zone ne peut pas être déplacée sous une de ses sous-zones (ni sous elle-même)
  const exclure = useCallback(
    (z) => modification && (z._id === zone._id || z.ancetres?.includes(zone._id)),
    [modification, zone],
  );

  const soumettre = async (v) => {
    setErreur(null);
    try {
      if (modification) {
        await modifier.mutateAsync({ id: zone._id, code: v.code.trim(), nom: v.nom.trim(), actif: v.actif, parent: v.parent });
        notifierSucces('Zone mise à jour');
      } else {
        await creer.mutateAsync({ code: v.code.trim(), nom: v.nom.trim(), niveau: niveauZone, parent: v.parent || undefined });
        notifierSucces('Zone créée');
      }
      onFermer();
    } catch (err) {
      setErreur(messageErreur(err));
    }
  };

  const deplacement = modification && form.getValues().parent !== (zone.parent || null);
  const titre = modification
    ? `Modifier : ${zone.nom}`
    : `Nouvelle zone – ${LIBELLES_NIVEAUX_ZONE[niveauZone]}${parent ? ` dans ${parent.nom}` : ''}`;

  return (
    <Modal opened={ouvert} onClose={onFermer} title={titre}>
      <form onSubmit={form.onSubmit(soumettre)} noValidate>
        <Stack>
          {erreur && <Alert color="red" icon={<IconAlertCircle />}>{erreur}</Alert>}
          <TextInput label="Code" withAsterisk placeholder="DS-01-03" data-autofocus {...form.getInputProps('code')} />
          <TextInput label="Nom" withAsterisk placeholder="District sanitaire de…" {...form.getInputProps('nom')} />
          {niveauZone !== 'NATIONAL' && (
            <SelectZone
              label={`Rattachée à (${LIBELLES_NIVEAUX_ZONE[niveauParent(niveauZone)]})`}
              withAsterisk
              niveaux={[niveauParent(niveauZone)]}
              exclure={exclure}
              allowDeselect={false}
              {...form.getInputProps('parent')}
            />
          )}
          {deplacement && (
            <Alert color="orange" variant="light">
              <Text size="sm">
                La zone, ses sous-zones et leurs centres seront déplacés. Les droits des utilisateurs affectés
                aux anciennes zones parentes ne couvriront plus ces centres.
              </Text>
            </Alert>
          )}
          {modification && <Switch label="Zone active" {...form.getInputProps('actif', { type: 'checkbox' })} />}
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onFermer}>Annuler</Button>
            <Button type="submit" loading={mutation.isPending}>{modification ? 'Enregistrer' : 'Créer'}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
