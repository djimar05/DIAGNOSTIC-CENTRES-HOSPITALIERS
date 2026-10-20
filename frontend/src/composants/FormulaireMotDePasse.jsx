import { useState } from 'react';
import { Alert, Button, PasswordInput, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle } from '@tabler/icons-react';
import { useAuth } from '../auth/AuthProvider';
import { messageErreur } from '../utils/erreurs';

/**
 * Changement de son propre mot de passe. `libelleAncien` permet de parler de « mot de passe
 * temporaire » sur l'écran de première connexion.
 */
export default function FormulaireMotDePasse({ onSucces, libelleAncien = 'Mot de passe actuel', libelleBouton = 'Changer le mot de passe' }) {
  const { changerMotDePasse } = useAuth();
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { ancien: '', nouveau: '', confirmation: '' },
    validate: {
      ancien: (v) => (v ? null : 'Obligatoire'),
      nouveau: (v, valeurs) => {
        if (v.length < 8) return 'Au moins 8 caractères';
        if (v === valeurs.ancien) return "Doit être différent de l'ancien";
        return null;
      },
      confirmation: (v, valeurs) => (v === valeurs.nouveau ? null : 'Les deux mots de passe ne correspondent pas'),
    },
  });

  const soumettre = async ({ ancien, nouveau }) => {
    setErreur(null);
    setEnvoi(true);
    try {
      await changerMotDePasse(ancien, nouveau);
      form.reset();
      onSucces?.();
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <form onSubmit={form.onSubmit(soumettre)} noValidate>
      <Stack>
        {erreur && <Alert color="red" icon={<IconAlertCircle />}>{erreur}</Alert>}
        <PasswordInput label={libelleAncien} autoComplete="current-password" key={form.key('ancien')} {...form.getInputProps('ancien')} />
        <PasswordInput
          label="Nouveau mot de passe"
          description="Au moins 8 caractères"
          autoComplete="new-password"
          key={form.key('nouveau')}
          {...form.getInputProps('nouveau')}
        />
        <PasswordInput label="Confirmer le nouveau mot de passe" autoComplete="new-password" key={form.key('confirmation')} {...form.getInputProps('confirmation')} />
        <Button type="submit" loading={envoi}>{libelleBouton}</Button>
      </Stack>
    </form>
  );
}
