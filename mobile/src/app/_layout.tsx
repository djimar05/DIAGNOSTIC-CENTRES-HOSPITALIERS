import { useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import EcranVerrou from '@/composants/EcranVerrou';
import { Bouton, EcranCentre } from '@/composants/ui';
import { SynchroProvider } from '@/hors-ligne/SynchroProvider';
import { couleurs } from '@/theme';

/**
 * Navigation selon la session (routes protégées d'Expo Router) :
 *   déconnecté               → connexion
 *   mot de passe temporaire  → changer-mot-de-passe
 *   pas encore de code PIN   → definir-pin
 *   connecté                 → mes missions, fiche mission, saisie de l'évaluation
 * L'écran de verrouillage (PIN) recouvre l'application sans perdre la navigation en cours.
 */
function Navigation() {
  const { etat, utilisateur, pin, verrouille, recharger, deconnecter } = useAuth();

  if (etat === 'chargement') {
    return <EcranCentre><ActivityIndicator size="large" color={couleurs.primaire} /></EcranCentre>;
  }
  if (etat === 'hors-ligne') {
    return (
      <EcranCentre>
        <Text style={{ fontSize: 18, fontWeight: '600', textAlign: 'center' }}>Serveur injoignable</Text>
        <Text style={{ textAlign: 'center', color: couleurs.texteSecondaire }}>
          Vérifiez votre connexion internet. La saisie hors ligne arrivera dans une prochaine version.
        </Text>
        <Bouton titre="Réessayer" onPress={recharger} />
        <Bouton titre="Se déconnecter" variante="secondaire" onPress={deconnecter} />
      </EcranCentre>
    );
  }

  const connecte = etat === 'connecte';
  const motDePasseAChanger = Boolean(utilisateur?.motDePasseAChanger);
  const pret = connecte && !motDePasseAChanger;

  return (
    <>
      <Stack screenOptions={{ headerTintColor: couleurs.primaire, contentStyle: { backgroundColor: couleurs.fond } }}>
        <Stack.Protected guard={!connecte}>
          <Stack.Screen name="connexion" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={connecte && motDePasseAChanger}>
          <Stack.Screen name="changer-mot-de-passe" options={{ title: 'Nouveau mot de passe', headerBackVisible: false }} />
        </Stack.Protected>
        <Stack.Protected guard={pret && pin === 'absent'}>
          <Stack.Screen name="definir-pin" options={{ title: 'Code PIN', headerBackVisible: false }} />
        </Stack.Protected>
        <Stack.Protected guard={pret && pin === 'defini'}>
          <Stack.Screen name="index" options={{ title: 'Mes missions' }} />
          <Stack.Screen name="mission/[id]" options={{ title: 'Mission' }} />
          <Stack.Screen name="evaluation/[id]/index" options={{ title: 'Évaluation' }} />
          <Stack.Screen name="evaluation/[id]/critere/[code]" options={{ title: 'Critère' }} />
          <Stack.Screen name="evaluation/[id]/recapitulatif" options={{ title: 'Récapitulatif' }} />
        </Stack.Protected>
      </Stack>
      {connecte && verrouille && <EcranVerrou />}
    </>
  );
}

export default function RootLayout() {
  // Pas de nouvel essai automatique sur les erreurs « métier » (4xx), seulement sur les coupures
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        retry: (essais, erreur: unknown) => essais < 2 && !((erreur as { status?: number })?.status && (erreur as { status: number }).status < 500),
      },
    },
  }));

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SynchroProvider>
            <StatusBar style="dark" />
            <Navigation />
          </SynchroProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
