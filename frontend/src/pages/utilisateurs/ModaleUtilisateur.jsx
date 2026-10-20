import { useEffect, useState } from 'react';
import { ActionIcon, Alert, Button, Group, Modal, Select, SimpleGrid, Stack, TextInput, Tooltip } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconRefresh } from '@tabler/icons-react';
import { useCreerUtilisateur, useModifierUtilisateur } from '../../api/utilisateurs';
import { LIBELLES_LANGUES } from '../../constantes/roles';
import { messageErreur } from '../../utils/erreurs';
import { genererMotDePasse } from '../../utils/motDePasse';

const OPTIONS_LANGUES = Object.entries(LIBELLES_LANGUES).map(([value, label]) => ({ value, label }));
const VIDE = { nom: '', prenom: '', telephone: '', email: '', fonction: '', langue: 'fr', motDePasse: '' };

/**
 * Création (sans `utilisateur`) ou modification d'un compte.
 * À la création, l'administrateur fixe un mot de passe temporaire que la personne devra changer.
 */
export default function ModaleUtilisateur({ ouvert, onFermer, utilisateur, onCree }) {
  const modification = Boolean(utilisateur);
  const creer = useCreerUtilisateur();
  const modifier = useModifierUtilisateur(utilisateur?._id);
  const mutation = modification ? modifier : creer;
  const [erreur, setErreur] = useState(null);

  const form = useForm({
    initialValues: VIDE,
    validate: {
      nom: (v) => (v.trim() ? null : 'Obligatoire'),
      telephone: (v) => (/^\+?[0-9 ]{8,20}$/.test(v.trim()) ? null : 'Numéro invalide (ex. +235 66 00 00 00)'),
      email: (v) => (!v || /^\S+@\S+\.\S+$/.test(v) ? null : 'E-mail invalide'),
      motDePasse: (v) => (modification || v.length >= 8 ? null : 'Au moins 8 caractères'),
    },
  });

  // Remplit le formulaire à chaque ouverture
  useEffect(() => {
    if (!ouvert) return;
    setErreur(null);
    form.setValues(modification
      ? { ...VIDE, ...Object.fromEntries(Object.keys(VIDE).map((k) => [k, utilisateur[k] ?? VIDE[k]])), motDePasse: '' }
      : { ...VIDE, motDePasse: genererMotDePasse() });
    form.resetDirty();
  }, [ouvert]); // eslint-disable-line react-hooks/exhaustive-deps

  const soumettre = async (valeurs) => {
    setErreur(null);
    const donnees = {
      nom: valeurs.nom.trim(),
      prenom: valeurs.prenom.trim(),
      telephone: valeurs.telephone.replace(/\s+/g, ''),
      email: valeurs.email.trim() || undefined,
      fonction: valeurs.fonction.trim(),
      langue: valeurs.langue,
      ...(!modification && { motDePasse: valeurs.motDePasse }),
    };
    try {
      const resultat = await mutation.mutateAsync(donnees);
      if (modification) {
        notifications.show({ color: 'teal', message: 'Compte mis à jour' });
      } else {
        notifications.show({
          color: 'teal',
          autoClose: false,
          title: 'Compte créé',
          message: `Mot de passe temporaire à transmettre à ${donnees.prenom || donnees.nom} : ${valeurs.motDePasse}`,
        });
        onCree?.(resultat);
      }
      onFermer();
    } catch (err) {
      setErreur(messageErreur(err));
    }
  };

  return (
    <Modal opened={ouvert} onClose={onFermer} title={modification ? 'Modifier le compte' : 'Nouvel utilisateur'} size="lg">
      <form onSubmit={form.onSubmit(soumettre)} noValidate>
        <Stack>
          {erreur && <Alert color="red" icon={<IconAlertCircle />}>{erreur}</Alert>}
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Nom" withAsterisk data-autofocus {...form.getInputProps('nom')} />
            <TextInput label="Prénom" {...form.getInputProps('prenom')} />
            <TextInput label="Téléphone" description="Identifiant de connexion" withAsterisk placeholder="+235 66 00 00 00" {...form.getInputProps('telephone')} />
            <TextInput label="E-mail" description="Facultatif, permet aussi de se connecter" {...form.getInputProps('email')} />
            <TextInput label="Fonction" placeholder="Médecin-chef de district" {...form.getInputProps('fonction')} />
            <Select label="Langue" data={OPTIONS_LANGUES} allowDeselect={false} {...form.getInputProps('langue')} />
          </SimpleGrid>
          {!modification && (
            <TextInput
              label="Mot de passe temporaire"
              description="À transmettre à la personne : elle devra le changer à sa première connexion"
              withAsterisk
              ff="monospace"
              rightSection={(
                <Tooltip label="Générer un autre mot de passe">
                  <ActionIcon variant="subtle" onClick={() => form.setFieldValue('motDePasse', genererMotDePasse())} aria-label="Générer">
                    <IconRefresh size={16} />
                  </ActionIcon>
                </Tooltip>
              )}
              {...form.getInputProps('motDePasse')}
            />
          )}
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onFermer}>Annuler</Button>
            <Button type="submit" loading={mutation.isPending}>{modification ? 'Enregistrer' : 'Créer le compte'}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
