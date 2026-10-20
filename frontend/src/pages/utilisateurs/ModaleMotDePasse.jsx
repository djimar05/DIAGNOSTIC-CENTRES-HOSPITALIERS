import { useEffect, useState } from 'react';
import { ActionIcon, Alert, Button, CopyButton, Group, Modal, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { IconAlertCircle, IconCheck, IconCopy, IconRefresh } from '@tabler/icons-react';
import { useReinitialiserMotDePasse } from '../../api/utilisateurs';
import { messageErreur } from '../../utils/erreurs';
import { nomComplet } from '../../utils/format';
import { genererMotDePasse } from '../../utils/motDePasse';

/** Réinitialisation par l'administrateur (mot de passe oublié) : nouveau mot de passe temporaire. */
export default function ModaleMotDePasse({ ouvert, onFermer, utilisateur }) {
  const reinitialiser = useReinitialiserMotDePasse(utilisateur._id);
  const [motDePasse, setMotDePasse] = useState('');
  const [termine, setTermine] = useState(false);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    if (!ouvert) return;
    setMotDePasse(genererMotDePasse());
    setTermine(false);
    setErreur(null);
  }, [ouvert]);

  const valider = async () => {
    if (motDePasse.length < 8) {
      setErreur('Au moins 8 caractères');
      return;
    }
    try {
      await reinitialiser.mutateAsync(motDePasse);
      setTermine(true);
    } catch (err) {
      setErreur(messageErreur(err));
    }
  };

  return (
    <Modal opened={ouvert} onClose={onFermer} title="Réinitialiser le mot de passe">
      {termine ? (
        <Stack>
          <Alert color="teal" icon={<IconCheck />}>
            Mot de passe réinitialisé. Les sessions de {nomComplet(utilisateur)} ont été fermées.
          </Alert>
          <Text size="sm">Transmettez-lui ce mot de passe temporaire ; il devra le changer à sa prochaine connexion :</Text>
          <Group gap="xs">
            <Text ff="monospace" fz="lg" fw={700}>{motDePasse}</Text>
            <CopyButton value={motDePasse}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? 'Copié' : 'Copier'}>
                  <ActionIcon variant="subtle" onClick={copy} aria-label="Copier">
                    {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </Group>
          <Group justify="flex-end"><Button onClick={onFermer}>Fermer</Button></Group>
        </Stack>
      ) : (
        <Stack>
          <Text size="sm">
            Un nouveau mot de passe temporaire va remplacer celui de <b>{nomComplet(utilisateur)}</b>.
            Toutes ses sessions seront fermées.
          </Text>
          {erreur && <Alert color="red" icon={<IconAlertCircle />}>{erreur}</Alert>}
          <TextInput
            label="Mot de passe temporaire"
            ff="monospace"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.currentTarget.value)}
            rightSection={(
              <Tooltip label="Générer un autre mot de passe">
                <ActionIcon variant="subtle" onClick={() => setMotDePasse(genererMotDePasse())} aria-label="Générer">
                  <IconRefresh size={16} />
                </ActionIcon>
              </Tooltip>
            )}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onFermer}>Annuler</Button>
            <Button color="orange" loading={reinitialiser.isPending} onClick={valider}>Réinitialiser</Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
