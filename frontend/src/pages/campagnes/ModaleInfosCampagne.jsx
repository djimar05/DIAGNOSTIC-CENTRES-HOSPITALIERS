import { useEffect, useState } from 'react';
import { Alert, Button, Group, Modal, Select, SimpleGrid, Stack, TextInput, Textarea } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useModifierCampagne } from '../../api/campagnes';
import { useGrilles } from '../../api/grilles';
import { messageErreur, notifierSucces } from '../../utils/erreurs';
import { versChampDate } from '../../utils/format';

/** Informations de la campagne. La grille n'est modifiable qu'en préparation. */
export default function ModaleInfosCampagne({ ouvert, onFermer, campagne }) {
  const modifier = useModifierCampagne();
  const { data: grilles = [] } = useGrilles({ statut: 'PUBLIEE' });
  const [v, setV] = useState({});
  const [erreur, setErreur] = useState(null);
  const enPreparation = campagne.statut === 'PREPARATION';

  useEffect(() => {
    if (!ouvert) return;
    setErreur(null);
    setV({
      nom: campagne.nom, description: campagne.description || '', partenaire: campagne.partenaire || '',
      dateDebut: versChampDate(campagne.dateDebut), dateFin: versChampDate(campagne.dateFin), grille: campagne.grille?._id,
    });
  }, [ouvert]); // eslint-disable-line react-hooks/exhaustive-deps

  const optionsGrilles = grilles.map((g) => ({ value: g._id, label: `${g.nom} (${g.code} v${g.version})` }));
  if (campagne.grille && !optionsGrilles.some((o) => o.value === campagne.grille._id)) {
    optionsGrilles.unshift({ value: campagne.grille._id, label: `${campagne.grille.nom} (${campagne.grille.code} v${campagne.grille.version})` });
  }

  const valider = async () => {
    try {
      await modifier.mutateAsync({ id: campagne._id, ...v, ...(enPreparation ? {} : { grille: undefined }) });
      notifierSucces('Campagne mise à jour');
      onFermer();
    } catch (err) {
      setErreur(messageErreur(err));
    }
  };

  return (
    <Modal opened={ouvert} onClose={onFermer} title="Informations de la campagne" size="lg">
      <Stack>
        {erreur && <Alert color="red" icon={<IconAlertCircle />}>{erreur}</Alert>}
        <TextInput label="Nom" value={v.nom || ''} onChange={(e) => setV({ ...v, nom: e.currentTarget.value })} />
        <Textarea label="Description" autosize minRows={2} value={v.description || ''} onChange={(e) => setV({ ...v, description: e.currentTarget.value })} />
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <TextInput type="date" label="Début" value={v.dateDebut || ''} onChange={(e) => setV({ ...v, dateDebut: e.currentTarget.value })} />
          <TextInput type="date" label="Fin" value={v.dateFin || ''} onChange={(e) => setV({ ...v, dateFin: e.currentTarget.value })} />
          <TextInput label="Partenaire" value={v.partenaire || ''} onChange={(e) => setV({ ...v, partenaire: e.currentTarget.value })} />
        </SimpleGrid>
        <Select
          label="Grille"
          description={enPreparation ? 'Changer de grille met à jour les évaluations planifiées' : 'Figée depuis le démarrage de la campagne'}
          data={optionsGrilles}
          value={v.grille || null}
          onChange={(grille) => setV({ ...v, grille })}
          disabled={!enPreparation}
          allowDeselect={false}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onFermer}>Annuler</Button>
          <Button onClick={valider} loading={modifier.isPending}>Enregistrer</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
