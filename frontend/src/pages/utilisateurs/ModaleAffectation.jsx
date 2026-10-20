import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Group, Modal, SegmentedControl, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDebouncedValue } from '@mantine/hooks';
import { IconAlertCircle } from '@tabler/icons-react';
import { useCentres } from '../../api/referentiel';
import { useCreerAffectation } from '../../api/utilisateurs';
import { useAuth } from '../../auth/AuthProvider';
import SelectZone from '../../composants/SelectZone';
import { LIBELLES_ROLES, ROLES, ROLES_DELEGABLES } from '../../constantes/roles';
import { messageErreur, notifierSucces } from '../../utils/erreurs';
import { versChampDate } from '../../utils/format';

const valeursInitiales = () => ({
  role: null, perimetre: 'ZONE', zone: null, centre: null, dateDebut: versChampDate(new Date()), dateFin: '',
});

/**
 * Donne un rôle sur un périmètre (national, zone ou centre).
 * Un coordonnateur ne propose que les rôles délégables et les zones / centres de son périmètre
 * (le backend applique les mêmes règles).
 */
export default function ModaleAffectation({ ouvert, onFermer, utilisateurId }) {
  const { aLeRole } = useAuth();
  const estAdmin = aLeRole('ADMINISTRATEUR');
  const creer = useCreerAffectation(utilisateurId);
  const [erreur, setErreur] = useState(null);

  const form = useForm({
    initialValues: valeursInitiales(),
    validate: {
      role: (v) => (v ? null : 'Choisissez un rôle'),
      zone: (v, f) => (f.perimetre !== 'ZONE' || v ? null : 'Choisissez une zone'),
      centre: (v, f) => (f.perimetre !== 'CENTRE' || v ? null : 'Choisissez un centre'),
      dateFin: (v, f) => (!v || !f.dateDebut || v >= f.dateDebut ? null : 'Doit être après la date de début'),
    },
  });
  const { role, perimetre } = form.getValues();

  useEffect(() => {
    if (!ouvert) return;
    form.setValues(valeursInitiales());
    setErreur(null);
  }, [ouvert]); // eslint-disable-line react-hooks/exhaustive-deps

  // Un responsable de centre est toujours rattaché à un centre
  useEffect(() => {
    if (role === 'RESPONSABLE_CENTRE') form.setFieldValue('perimetre', 'CENTRE');
  }, [role]); // eslint-disable-line react-hooks/exhaustive-deps

  const optionsRoles = (estAdmin ? ROLES : ROLES_DELEGABLES).map((r) => ({ value: r, label: LIBELLES_ROLES[r] }));
  const optionsPerimetre = [
    ...(estAdmin ? [{ value: 'NATIONAL', label: 'National' }] : []),
    { value: 'ZONE', label: 'Zone' },
    { value: 'CENTRE', label: 'Centre' },
  ].map((o) => ({ ...o, disabled: role === 'RESPONSABLE_CENTRE' && o.value !== 'CENTRE' }));

  // Centres : recherche côté serveur (il peut y en avoir des milliers)
  const [rechercheCentre, setRechercheCentre] = useState('');
  const [rechercheDifferee] = useDebouncedValue(rechercheCentre, 300);
  const [centreChoisi, setCentreChoisi] = useState(null);
  const { data: reponseCentres, isFetching: chargementCentres } = useCentres(
    { recherche: rechercheDifferee, limite: 30 },
    { enabled: ouvert && perimetre === 'CENTRE' },
  );
  const optionsCentres = useMemo(() => {
    const options = (reponseCentres?.data || []).map((c) => ({ value: c._id, label: `${c.nom} (${c.code})` }));
    if (centreChoisi && !options.some((o) => o.value === centreChoisi.value)) options.unshift(centreChoisi);
    return options;
  }, [reponseCentres, centreChoisi]);

  const soumettre = async (v) => {
    setErreur(null);
    try {
      await creer.mutateAsync({
        role: v.role,
        ...(v.perimetre === 'ZONE' && { zone: v.zone }),
        ...(v.perimetre === 'CENTRE' && { centre: v.centre }),
        ...(v.dateDebut && { dateDebut: v.dateDebut }),
        ...(v.dateFin && { dateFin: v.dateFin }),
      });
      notifierSucces('Affectation ajoutée');
      onFermer();
    } catch (err) {
      setErreur(messageErreur(err));
    }
  };

  return (
    <Modal opened={ouvert} onClose={onFermer} title="Nouvelle affectation" size="lg">
      <form onSubmit={form.onSubmit(soumettre)} noValidate>
        <Stack>
          {erreur && <Alert color="red" icon={<IconAlertCircle />}>{erreur}</Alert>}
          <Select label="Rôle" withAsterisk data={optionsRoles} placeholder="Choisir un rôle" {...form.getInputProps('role')} />

          <div>
            <Text size="sm" fw={500} mb={4}>Périmètre</Text>
            <SegmentedControl fullWidth data={optionsPerimetre} key={form.key('perimetre')} {...form.getInputProps('perimetre')} />
          </div>

          {perimetre === 'NATIONAL' && (
            <Text size="sm" c="dimmed">Accès à tout le pays.</Text>
          )}
          {perimetre === 'ZONE' && (
            <SelectZone
              label="Zone"
              description="La zone choisie et toutes celles qui en dépendent"
              withAsterisk
              {...form.getInputProps('zone')}
            />
          )}
          {perimetre === 'CENTRE' && (
            <Select
              label="Centre"
              withAsterisk
              searchable
              data={optionsCentres}
              filter={({ options }) => options} // déjà filtrés par le serveur
              searchValue={rechercheCentre}
              onSearchChange={setRechercheCentre}
              nothingFoundMessage={chargementCentres ? 'Recherche…' : 'Aucun centre'}
              placeholder="Nom ou code du centre"
              {...form.getInputProps('centre')}
              onChange={(valeur, option) => {
                form.setFieldValue('centre', valeur);
                setCentreChoisi(option);
              }}
            />
          )}

          <SimpleGrid cols={2}>
            <TextInput type="date" label="Début" {...form.getInputProps('dateDebut')} />
            <TextInput type="date" label="Fin" description="Facultatif" {...form.getInputProps('dateFin')} />
          </SimpleGrid>

          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onFermer}>Annuler</Button>
            <Button type="submit" loading={creer.isPending}>Ajouter</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
