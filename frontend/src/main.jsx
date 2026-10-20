import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DirectionProvider, MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { AuthProvider } from './auth/AuthProvider';
import { router } from './router';
import { theme } from './theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false, // économise la bande passante (3G)
      // Pas de nouvel essai sur les erreurs « métier » (4xx) : seulement sur les coupures réseau / 5xx
      retry: (essais, erreur) => essais < 2 && !(erreur?.status >= 400 && erreur?.status < 500),
    },
  },
});

// DirectionProvider : prêt pour l'interface en arabe (droite à gauche), prévue au lot 2
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DirectionProvider>
      <MantineProvider theme={theme}>
        <Notifications position="top-right" />
        <QueryClientProvider client={queryClient}>
          <ModalsProvider>
            <AuthProvider>
              <RouterProvider router={router} />
            </AuthProvider>
          </ModalsProvider>
        </QueryClientProvider>
      </MantineProvider>
    </DirectionProvider>
  </StrictMode>,
);
