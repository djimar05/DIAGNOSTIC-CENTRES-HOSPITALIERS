import { useEffect, useState } from 'react';
import {
  Alert, Button, Divider, Group, Modal, NumberInput, Select, SimpleGrid, Stack, Switch, TagsInput, Text, TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle } from '@tabler/icons-react';
import { useCreerCentre, useModifierCentre } from '../../api/referentiel';
import SelectZone from '../../composants/SelectZone';
import {
  LIBELLES_NIVEAUX_CENTRE, LIBELLES_STATUTS_JURIDIQUES, SERVICES_COURANTS, options,
} from '../../constantes/referentiel';
import { messageErreur, notifierSucces } from '../../utils/erreurs';

const VIDE = {
  code: '', nom: '', niveau: null, statutJuridique: 'PUBLIC', zone: null, localite: '',
  longitude: '', latitude: '', populationDesservie: '', nombreLits: '', services: [],
  responsableNom: '', responsableTelephone: '', actif: true,
};

const versFormulaire = (c) => ({
  code: c.code, nom: c.nom, niveau: c.niveau, statutJuridique: c.statutJuridique || 'PUBLIC',
  zone: c.zone?._id || c.zone, localite: c.localite || '',
  longitude: c.gps?.coordinates?.[0] ?? '', latitude: c.gps?.coordinates?.[1] ?? '',
  populationDesservie: c.populationDesservie ?? '', nombreLits: c.nombreLits ?? '',
  services: c.services || [], responsableNom: c.responsable?.nom || '',
  responsableTelephone: c.responsable?.telephone || '', actif: c.actif,
});

const nombreOuNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

/** Création (sans `centre`) ou modification de la fiche d'un centre. */
export default function ModaleCentre({ ouvert, onFermer, centre, onCree }) {
  const modification = Boolean(centre);
  const creer = useCreerCentre();
  const modifier = useModifierCentre(centre?._id);
  const mutation = modification ? modifier : creer;
  const [erreur, setErreur] = useState(null);

  const form = useForm({
    initialValues: VIDE,
    validate: {
      code: (v) => (v.trim() ? null : 'Obligatoire'),
      nom: (v) => (v.trim() ? null : 'Obligatoire'),
      niveau: (v) => (v ? null : 'Obligatoire'),
      zone: (v) => (v ? null : 'Obligatoire'),
      longitude: (v, f) => {
        if (v === '' && f.latitude === '') return null;
        if (v === '' || f.latitude === '') return 'Longitude et latitude vont ensemble';
        return v >= -180 && v <= 180 ? null : 'Entre -180 et 180';
      },
      latitude: (v) => (v === '' || (v >= -90 && v <= 90) ? null : 'Entre -90 et 90'),
    },
  });

  useEffect(() => {
    if (!ouvert) return;
    setErreur(null);
    form.setValues(modification ? versFormulaire(centre) : VIDE);
  }, [ouvert]); // eslint-disable-line react-hooks/exhaustive-deps

  const soumettre = async (v) => {
    setErreur(null);
    const avecGps = v.longitude !== '' && v.latitude !== '';
    const donnees = {
      code: v.code.trim(),
      nom: v.nom.trim(),
      niveau: v.niveau,
      statutJuridique: v.statutJuridique,
      zone: v.zone,
      localite: v.localite.trim() || null,
      gps: avecGps ? { type: 'Point', coordinates: [Number(v.longitude), Number(v.latitude)] } : null,
      populationDesservie: nombreOuNull(v.populationDesservie),
      nombreLits: nombreOuNull(v.nombreLits),
      services: v.services,
      responsable: { nom: v.responsableNom.trim() || undefined, telephone: v.responsableTelephone.trim() || undefined },
      actif: v.actif,
    };
    try {
      const resultat = await mutation.mutateAsync(donnees);
      notifierSucces(modification ? 'Centre mis à jour' : 'Centre créé');
      if (!modification) onCree?.(resultat);
      onFermer();
    } catch (err) {
      setErreur(messageErreur(err));
    }
  };

  return (
    <Modal opened={ouvert} onClose={onFermer} title={modification ? `Modifier : ${centre.nom}` : 'Nouveau centre'} size="xl">
      <form onSubmit={form.onSubmit(soumettre)} noValidate>
        <Stack>
          {erreur && <Alert color="red" icon={<IconAlertCircle />}>{erreur}</Alert>}
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <TextInput label="Code" withAsterisk placeholder="CS-0142" data-autofocus {...form.getInputProps('code')} />
            <TextInput label="Nom" withAsterisk style={{ gridColumn: 'span 2' }} {...form.getInputProps('nom')} />
            <Select label="Niveau" withAsterisk data={options(LIBELLES_NIVEAUX_CENTRE)} {...form.getInputProps('niveau')} />
            <Select label="Statut juridique" data={options(LIBELLES_STATUTS_JURIDIQUES)} allowDeselect={false} {...form.getInputProps('statutJuridique')} />
            <SelectZone
              label="Zone de rattachement"
              withAsterisk
              niveaux={['REGION', 'DISTRICT', 'ZONE_RESPONSABILITE']}
              {...form.getInputProps('zone')}
            />
          </SimpleGrid>

          <Divider label="Localisation" labelPosition="left" />
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <TextInput label="Localité" placeholder="Village, quartier" {...form.getInputProps('localite')} />
            <NumberInput label="Longitude" placeholder="15.0444" decimalScale={6} hideControls {...form.getInputProps('longitude')} />
            <NumberInput label="Latitude" placeholder="12.1348" decimalScale={6} hideControls {...form.getInputProps('latitude')} />
          </SimpleGrid>
          <Text size="xs" c="dimmed" mt={-8}>Degrés décimaux. Les coordonnées pourront aussi être relevées sur place par l'évaluateur.</Text>

          <Divider label="Capacités" labelPosition="left" />
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <NumberInput label="Population desservie" min={0} allowDecimal={false} thousandSeparator=" " {...form.getInputProps('populationDesservie')} />
            <NumberInput label="Nombre de lits" min={0} allowDecimal={false} {...form.getInputProps('nombreLits')} />
          </SimpleGrid>
          <TagsInput
            label="Services disponibles"
            description="Choisissez dans la liste ou saisissez puis appuyez sur Entrée"
            data={SERVICES_COURANTS}
            clearable
            {...form.getInputProps('services')}
            onChange={(valeurs) => form.setFieldValue('services', valeurs.map((s) => s.trim().toUpperCase().replace(/\s+/g, '_')))}
          />

          <Divider label="Responsable" labelPosition="left" />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Nom" placeholder="Major du centre" {...form.getInputProps('responsableNom')} />
            <TextInput label="Téléphone" placeholder="+235 66 00 00 00" {...form.getInputProps('responsableTelephone')} />
          </SimpleGrid>

          {modification && <Switch label="Centre actif" description="Un centre inactif n'est plus proposé pour les nouvelles campagnes" {...form.getInputProps('actif', { type: 'checkbox' })} />}

          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onFermer}>Annuler</Button>
            <Button type="submit" loading={mutation.isPending}>{modification ? 'Enregistrer' : 'Créer le centre'}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
