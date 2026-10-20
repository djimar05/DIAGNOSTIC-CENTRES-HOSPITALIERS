import { createTheme } from '@mantine/core';

// Couleur principale : bleu-vert « santé ». 10 nuances, de la plus claire à la plus foncée.
export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: 7,
  colors: {
    brand: [
      '#e3fafc', '#c5f6fa', '#99e9f2', '#66d9e8', '#3bc9db',
      '#22b8cf', '#15aabf', '#0b7285', '#0a6475', '#085563',
    ],
  },
  defaultRadius: 'md',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Arabic", sans-serif',
});
