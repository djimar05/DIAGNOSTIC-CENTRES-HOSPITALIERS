import { useEffect, useState } from 'react';
import { Alert, Button, Group, List, Modal, Stack, Text } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useAjouterMissions } from '../../api/campagnes';
import { messageErreur, notifierSucces } from '../../utils/erreurs';
import SelectionCentres from './SelectionCentres';

/** Ajoute des centres (missions) à une campagne existante. */
export default function ModaleAjoutCentres({ ouvert, onFermer, campagne, centresPresents }) {
  const ajouter = useAjouterMissions();
  const [centres, setCentres] = useState([]);
  const [rapport, setRapport] = useState(null);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    if (ouvert) { setCentres([]); setRapport(null); setErreur(null); }
  }, [ouvert]);

  const valider = async () => {
    setErreur(null);
    try {
      const r = await ajouter.mutateAsync({ id: campagne._id, centres });
      notifierSucces(`${r.creees} centre(s) ajouté(s)`);
      if (r.refus.length || r.avertissements.length) setRapport(r); else onFermer();
      setCentres([]);
    } catch (err) {
      setErreur(messageErreur(err));
    }
  };

  return (
    <Modal opened={ouvert} onClose={onFermer} title="Ajouter des centres" size="xl">
      <Stack>
        {erreur && <Alert color="red" icon={<IconAlertCircle />}>{erreur}</Alert>}
        {rapport && (
          <Alert color="orange" title="Certains centres n'ont pas été ajoutés">
            <List size="sm">
              {rapport.refus.map((r) => <List.Item key={r.centre}>{r.code || r.centre} : {r.motif}</List.Item>)}
              {rapport.avertissements.map((a) => <List.Item key={a}>{a}</List.Item>)}
            </List>
          </Alert>
        )}
        <Text size="sm">Les nouveaux centres sont ajoutés sans équipe : affectez-la ensuite depuis l'onglet Missions.</Text>
        <SelectionCentres
          zone={campagne.zone?._id}
          niveaux={campagne.grille?.niveauxCibles || []}
          valeur={centres}
          onChange={setCentres}
          exclus={centresPresents}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onFermer}>Fermer</Button>
          <Button onClick={valider} disabled={!centres.length} loading={ajouter.isPending}>Ajouter {centres.length || ''} centre(s)</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
