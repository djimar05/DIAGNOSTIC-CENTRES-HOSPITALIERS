import { useEffect, useState } from 'react';
import { Alert, Button, Group, Modal, MultiSelect, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle } from '@tabler/icons-react';
import { useCreerGrille } from '../../api/grilles';
import { LIBELLES_NIVEAUX_CENTRE, options } from '../../constantes/referentiel';
import { messageErreur } from '../../utils/erreurs';

/** Nouvelle grille vide (brouillon, version 1). Le contenu se construit ensuite dans l'éditeur. */
export default function ModaleNouvelleGrille({ ouvert, onFermer, onCree }) {
  const creer = useCreerGrille();
  const [erreur, setErreur] = useState(null);
  const form = useForm({
    initialValues: { code: '', nom: '', niveauxCibles: [] },
    validate: {
      code: (v) => (/^[A-Za-z0-9_-]{2,30}$/.test(v.trim()) ? null : 'Lettres, chiffres, tirets (ex. GRILLE-CS)'),
      nom: (v) => (v.trim() ? null : 'Obligatoire'),
    },
  });

  useEffect(() => {
    if (ouvert) { form.reset(); setErreur(null); }
  }, [ouvert]); // eslint-disable-line react-hooks/exhaustive-deps

  const soumettre = async (v) => {
    try {
      const grille = await creer.mutateAsync({ code: v.code.trim(), nom: v.nom.trim(), niveauxCibles: v.niveauxCibles, domaines: [] });
      onCree(grille);
    } catch (err) {
      setErreur(messageErreur(err));
    }
  };

  return (
    <Modal opened={ouvert} onClose={onFermer} title="Nouvelle grille">
      <form onSubmit={form.onSubmit(soumettre)} noValidate>
        <Stack>
          {erreur && <Alert color="red" icon={<IconAlertCircle />}>{erreur}</Alert>}
          <TextInput label="Code" description="Identifiant stable, commun à toutes les versions" withAsterisk placeholder="GRILLE-CS" data-autofocus {...form.getInputProps('code')} />
          <TextInput label="Nom" withAsterisk placeholder="Grille des centres et postes de santé" {...form.getInputProps('nom')} />
          <MultiSelect label="Niveaux de centre ciblés" data={options(LIBELLES_NIVEAUX_CENTRE)} placeholder="Choisir" {...form.getInputProps('niveauxCibles')} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onFermer}>Annuler</Button>
            <Button type="submit" loading={creer.isPending}>Créer et ouvrir l'éditeur</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
