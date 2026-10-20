import { Suspense } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { AppShell, Avatar, Burger, Center, Group, Loader, Menu, NavLink, Text, ThemeIcon, UnstyledButton } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconChevronDown, IconLogout, IconPlus, IconUserCircle } from '@tabler/icons-react';
import { useAuth } from '../auth/AuthProvider';
import { libelleRole } from '../constantes/roles';
import { initiales } from '../utils/format';
import { NAVIGATION } from './navigation';

export default function AppLayout() {
  const [menuOuvert, { toggle, close }] = useDisclosure();
  const { utilisateur, deconnecter, aLeRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const entrees = NAVIGATION.filter((e) => !e.roles || aLeRole(...e.roles));
  const nomComplet = [utilisateur.prenom, utilisateur.nom].filter(Boolean).join(' ');

  const seDeconnecter = async () => {
    await deconnecter();
    navigate('/connexion', { replace: true });
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !menuOuvert } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={menuOuvert} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Ouvrir le menu" />
            <ThemeIcon radius="md" size="lg"><IconPlus stroke={3} /></ThemeIcon>
            <Text fw={700} visibleFrom="xs">Diagnostic des centres Hospitaliers</Text>
          </Group>

          <Menu position="bottom-end" width={240}>
            <Menu.Target>
              <UnstyledButton aria-label="Menu du compte">
                <Group gap="xs" wrap="nowrap">
                  <Avatar color="brand" radius="xl" size="sm">{initiales(utilisateur)}</Avatar>
                  <div style={{ lineHeight: 1.1 }}>
                    <Text size="sm" fw={600} truncate maw={180}>{nomComplet}</Text>
                    <Text size="xs" c="dimmed" truncate maw={180} visibleFrom="xs">
                      {utilisateur.roles.map(libelleRole).join(', ') || 'Aucun rôle'}
                    </Text>
                  </div>
                  <IconChevronDown size={14} />
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{utilisateur.telephone}</Menu.Label>
              <Menu.Item component={Link} to="/profil" leftSection={<IconUserCircle size={16} />}>
                Mon profil
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={seDeconnecter}>
                Se déconnecter
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        {entrees.map(({ libelle, chemin, icone: Icone }) => (
          <NavLink
            key={chemin}
            component={Link}
            to={chemin}
            label={libelle}
            leftSection={<Icone size={18} />}
            active={chemin === '/' ? location.pathname === '/' : location.pathname.startsWith(chemin)}
            onClick={close}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main>
        {/* Les écrans sont chargés à la demande (voir router.jsx) */}
        <Suspense fallback={<Center p="xl"><Loader /></Center>}>
          <Outlet />
        </Suspense>
      </AppShell.Main>
    </AppShell>
  );
}
