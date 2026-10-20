import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { Alert, Button, Center, Code, Paper, PasswordInput, Stack, Text, TextInput, ThemeIcon, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle, IconPlus } from '@tabler/icons-react';
import { useAuth } from '../auth/AuthProvider';

export default function ConnexionPage() {
  const { utilisateur, connecter } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { identifiant: '', motDePasse: '' },
    validate: {
      identifiant: (v) => (v.trim() ? null : 'Saisissez votre téléphone ou votre e-mail'),
      motDePasse: (v) => (v ? null : 'Saisissez votre mot de passe'),
    },
  });

  const destination = location.state?.depuis?.pathname || '/';
  if (utilisateur) return <Navigate to={destination} replace />;

  const soumettre = async ({ identifiant, motDePasse }) => {
    setErreur(null);
    setEnvoi(true);
    try {
      await connecter(identifiant.trim(), motDePasse);
      navigate(destination, { replace: true });
    } catch (err) {
      setErreur(err.status ? err.message : 'Serveur injoignable. Vérifiez votre connexion internet.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Center mih="100vh" p="md" bg="var(--mantine-color-gray-0)">
      <Paper withBorder shadow="sm" radius="md" p="xl" w="100%" maw={400}>
        <Stack>
          <Stack gap={4} align="center">
            <ThemeIcon size={48} radius="md"><IconPlus size={28} stroke={3} /></ThemeIcon>
            <Title order={2} ta="center">Diagnostic des centres</Title>
            <Text c="dimmed" size="sm" ta="center">Connectez-vous pour accéder à votre espace</Text>
          </Stack>

          {erreur && <Alert color="red" icon={<IconAlertCircle />}>{erreur}</Alert>}

          <form onSubmit={form.onSubmit(soumettre)} noValidate>
            <Stack>
              <TextInput
                label="Téléphone ou e-mail"
                placeholder="+235 66 00 00 00"
                autoComplete="username"
                autoFocus
                key={form.key('identifiant')}
                {...form.getInputProps('identifiant')}
              />
              <PasswordInput
                label="Mot de passe"
                autoComplete="current-password"
                key={form.key('motDePasse')}
                {...form.getInputProps('motDePasse')}
              />
              <Button type="submit" loading={envoi} fullWidth mt="xs">Se connecter</Button>
            </Stack>
          </form>

          {import.meta.env.DEV && (
            <Text size="xs" c="dimmed" ta="center">
              Démo (après <Code>npm run seed</Code>) : <Code>+235660000100</Code> / <Code>Demo2026!</Code>
            </Text>
          )}
        </Stack>
      </Paper>
    </Center>
  );
}
