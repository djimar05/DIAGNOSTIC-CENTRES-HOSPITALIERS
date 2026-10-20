import { Badge, Group, Text } from '@mantine/core';
import { COULEURS_ROLES, libelleRole } from '../constantes/roles';

export function BadgeRole({ role, ...props }) {
  return <Badge variant="light" color={COULEURS_ROLES[role]} {...props}>{libelleRole(role)}</Badge>;
}

export default function BadgesRoles({ roles = [] }) {
  if (!roles.length) return <Text size="sm" c="dimmed">Aucun rôle</Text>;
  return (
    <Group gap={4}>
      {roles.map((r) => <BadgeRole key={r} role={r} size="sm" />)}
    </Group>
  );
}
