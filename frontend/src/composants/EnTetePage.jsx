import { Group, Text, Title } from '@mantine/core';

/** Titre de page, sous-titre facultatif et actions à droite (passent à la ligne sur mobile). */
export default function EnTetePage({ titre, sousTitre, children }) {
  return (
    <Group justify="space-between" align="flex-end" mb="md" gap="sm">
      <div>
        <Title order={2}>{titre}</Title>
        {sousTitre && <Text c="dimmed" size="sm">{sousTitre}</Text>}
      </div>
      {children && <Group gap="xs">{children}</Group>}
    </Group>
  );
}
