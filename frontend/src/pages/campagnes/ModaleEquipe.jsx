import { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Group, List, Modal, Stack, Text, TextInput } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useAffecterEquipe, useIntervenants, useModifierMission } from '../../api/campagnes';
import { messageErreur, notifierSucces } from '../../utils/erreurs';
import { versChampDate } from '../../utils/format';
import ChampsEquipe from './ChampsEquipe';

/**
 * Équipe et date d'une ou plusieurs missions.
 * Pour plusieurs missions, on choisit ce qu'on modifie (équipe et/ou date) ; le reste est conservé.
 */
export default function ModaleEquipe({ ouvert, onFermer, campagneId, missions = [] }) {
  const unique = missions.length === 1 ? missions[0] : null;
  const { data: intervenants, isPending } = useIntervenants({ campagne: campagneId }, { enabled: ouvert });
  const modifier = useModifierMission();
  const affecter = useAffecterEquipe();
  const [equipe, setEquipe] = useState({ evaluateurs: [], superviseur: null });
  const [datePrevue, setDatePrevue] = useState('');
  const [champs, setChamps] = useState({ equipe: true, date: true });
  const [erreur, setErreur] = useState(null);
  const [refus, setRefus] = useState([]);

  useEffect(() => {
    if (!ouvert) return;
    setErreur(null);
    setRefus([]);
    setEquipe({ evaluateurs: unique ? unique.evaluateurs.map((e) => e._id) : [], superviseur: unique?.superviseur?._id || null });
    setDatePrevue(unique ? versChampDate(unique.datePrevue) : '');
    setChamps({ equipe: true, date: Boolean(unique) });
  }, [ouvert]); // eslint-disable-line react-hooks/exhaustive-deps

  const valider = async () => {
    setErreur(null);
    const donnees = {
      ...(champs.equipe && { evaluateurs: equipe.evaluateurs, superviseur: equipe.superviseur || null }),
      ...(champs.date && { datePrevue: datePrevue || null }),
    };
    try {
      if (unique) {
        await modifier.mutateAsync({ id: unique._id, ...donnees });
        notifierSucces('Mission mise à jour');
        onFermer();
      } else {
        const r = await affecter.mutateAsync({ id: campagneId, missions: missions.map((m) => m._id), ...donnees });
        notifierSucces(`${r.modifiees} mission(s) mise(s) à jour`);
        if (r.refus.length) setRefus(r.refus); else onFermer();
      }
    } catch (err) {
      setErreur(messageErreur(err));
    }
  };

  const titre = unique ? `Équipe – ${unique.centre.nom}` : `Équipe et date de ${missions.length} mission(s)`;
  return (
    <Modal opened={ouvert} onClose={onFermer} title={titre} size="lg">
      <Stack>
        {erreur && <Alert color="red" icon={<IconAlertCircle />}>{erreur}</Alert>}
        {refus.length > 0 && (
          <Alert color="orange" title="Missions non modifiées">
            <List size="sm">{refus.map((r, i) => <List.Item key={i}>{r.code ? `${r.code} – ${r.nom} : ` : ''}{r.motif}</List.Item>)}</List>
          </Alert>
        )}
        {!unique && <Checkbox label="Modifier l'équipe" checked={champs.equipe} onChange={(e) => setChamps((c) => ({ ...c, equipe: e.currentTarget.checked }))} />}
        {champs.equipe && (
          <ChampsEquipe intervenants={intervenants} chargement={isPending} evaluateurs={equipe.evaluateurs} superviseur={equipe.superviseur} onChange={setEquipe} />
        )}
        {!unique && <Checkbox label="Modifier la date de visite" checked={champs.date} onChange={(e) => setChamps((c) => ({ ...c, date: e.currentTarget.checked }))} />}
        {champs.date && <TextInput type="date" label="Date de visite prévue" w={240} value={datePrevue} onChange={(e) => setDatePrevue(e.currentTarget.value)} />}
        <Text size="xs" c="dimmed">Chaque personne doit être affectée (rôle et zone) sur le centre ; le serveur le vérifie mission par mission.</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onFermer}>{refus.length ? 'Fermer' : 'Annuler'}</Button>
          <Button onClick={valider} disabled={!champs.equipe && !champs.date} loading={modifier.isPending || affecter.isPending}>Enregistrer</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
