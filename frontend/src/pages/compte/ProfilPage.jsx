import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Card, Grid, Group, Select, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconDevicesOff } from '@tabler/icons-react';
import { useAuth } from '../../auth/AuthProvider';
import CartesAffectations from '../../composants/CartesAffectations';
import EnTetePage from '../../composants/EnTetePage';
import FormulaireMotDePasse from '../../composants/FormulaireMotDePasse';
import { LIBELLES_LANGUES } from '../../constantes/roles';
import { notifierErreur, notifierSucces } from '../../utils/erreurs';
import { formatDateHeure, nomComplet } from '../../utils/format';

function Info({ libelle, valeur }) {
  return (
    <div>
      <Text size="xs" c="dimmed">{libelle}</Text>
      <Text size="sm">{valeur || '—'}</Text>
    </div>
  );
}

export default function ProfilPage() {
  const { utilisateur, mettreAJourProfil, deconnecterPartout } = useAuth();
  const navigate = useNavigate();
  const [enregistrementLangue, setEnregistrementLangue] = useState(false);

  const changerLangue = async (langue) => {
    if (!langue || langue === utilisateur.langue) return;
    setEnregistrementLangue(true);
    try {
      await mettreAJourProfil({ langue });
      notifierSucces('Langue enregistrée');
    } catch (err) {
      notifierErreur(err);
    } finally {
      setEnregistrementLangue(false);
    }
  };

  const confirmerDeconnexionPartout = () => modals.openConfirmModal({
    title: 'Se déconnecter de tous les appareils ?',
    children: (
      <Text size="sm">
        Toutes vos sessions seront fermées (ordinateurs, téléphones, tablettes), y compris celle-ci.
        Utile si vous avez perdu un appareil.
      </Text>
    ),
    labels: { confirm: 'Tout déconnecter', cancel: 'Annuler' },
    confirmProps: { color: 'red' },
    onConfirm: async () => {
      try {
        await deconnecterPartout();
        navigate('/connexion', { replace: true });
      } catch (err) {
        notifierErreur(err);
      }
    },
  });

  return (
    <Stack maw={1000}>
      <EnTetePage titre="Mon profil" sousTitre="Vos informations sont gérées par l'administrateur" />

      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder h="100%">
            <Title order={4} mb="sm">{nomComplet(utilisateur)}</Title>
            <SimpleGrid cols={2} spacing="sm">
              <Info libelle="Téléphone" valeur={utilisateur.telephone} />
              <Info libelle="E-mail" valeur={utilisateur.email} />
              <Info libelle="Fonction" valeur={utilisateur.fonction} />
              <Info libelle="Dernière connexion" valeur={formatDateHeure(utilisateur.derniereConnexion)} />
            </SimpleGrid>
            <Select
              mt="md"
              label="Langue de l'interface"
              description="L'interface en arabe arrivera dans une prochaine version"
              data={Object.entries(LIBELLES_LANGUES).map(([value, label]) => ({ value, label }))}
              value={utilisateur.langue}
              onChange={changerLangue}
              disabled={enregistrementLangue}
              allowDeselect={false}
              maw={280}
            />
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder h="100%">
            <Title order={4} mb="sm">Changer mon mot de passe</Title>
            <FormulaireMotDePasse onSucces={() => notifierSucces('Mot de passe changé. Vos autres appareils ont été déconnectés.')} />
          </Card>
        </Grid.Col>
      </Grid>

      <Title order={4} mt="md">Mes affectations</Title>
      <CartesAffectations affectations={utilisateur.affectations} />

      <Card withBorder mt="md">
        <Group justify="space-between">
          <div>
            <Text fw={600}>Sessions</Text>
            <Text size="sm" c="dimmed">Fermer toutes vos sessions ouvertes sur d'autres appareils.</Text>
          </div>
          <Button variant="light" color="red" leftSection={<IconDevicesOff size={16} />} onClick={confirmerDeconnexionPartout}>
            Se déconnecter de tous les appareils
          </Button>
        </Group>
      </Card>
    </Stack>
  );
}
