import { useMemo } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { messageErreur } from '@/api/client';
import { useMesMissions } from '@/api/missions';
import type { Mission } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import CarteMission from '@/composants/CarteMission';
import { Alerte, Bouton, EcranCentre } from '@/composants/ui';
import { couleurs, espace } from '@/theme';
import { debutDuJour, nomComplet } from '@/utils/format';

const A_FAIRE = ['PLANIFIEE', 'EN_COURS', 'A_CORRIGER'];

/** Répartit les missions : à corriger, en retard, à venir, sans date, terminées. */
const sections = (missions: Mission[]) => {
  const aujourdhui = debutDuJour();
  const statut = (m: Mission) => m.evaluation?.statut || 'PLANIFIEE';
  const actives = missions.filter((m) => m.statut !== 'ANNULEE' && A_FAIRE.includes(statut(m)));
  const retard = (m: Mission) => Boolean(m.datePrevue) && new Date(m.datePrevue!) < aujourdhui && statut(m) !== 'A_CORRIGER';
  return [
    { titre: 'À corriger', data: actives.filter((m) => statut(m) === 'A_CORRIGER') },
    { titre: 'En retard', data: actives.filter(retard) },
    { titre: 'À venir', data: actives.filter((m) => m.datePrevue && !retard(m) && statut(m) !== 'A_CORRIGER') },
    { titre: 'Date à fixer', data: actives.filter((m) => !m.datePrevue && statut(m) !== 'A_CORRIGER') },
    { titre: 'Terminées', data: missions.filter((m) => !actives.includes(m)) },
  ].filter((s) => s.data.length);
};

/** M2 – Mes missions (lecture seule pour l'instant). */
export default function MesMissions() {
  const { utilisateur, deconnecter, aLeRole } = useAuth();
  const { data: missions = [], isPending, error, refetch, isRefetching } = useMesMissions();
  const liste = useMemo(() => sections(missions), [missions]);
  const aujourdhui = debutDuJour();

  const confirmerDeconnexion = () => Alert.alert('Se déconnecter ?', 'Vous devrez saisir à nouveau votre mot de passe.', [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Se déconnecter', style: 'destructive', onPress: deconnecter },
  ]);
  const entete = (
    <Stack.Screen options={{
      headerRight: () => (
        <Pressable onPress={confirmerDeconnexion} hitSlop={8} accessibilityRole="button">
          <Text style={{ color: couleurs.primaire, fontWeight: '600' }}>Déconnexion</Text>
        </Pressable>
      ),
    }} />
  );

  // L'application mobile est faite pour les équipes de terrain
  if (!aLeRole('EVALUATEUR', 'SUPERVISEUR')) {
    return (
      <EcranCentre>
        {entete}
        <Text style={styles.titreVide}>Application réservée aux équipes de terrain</Text>
        <Text style={styles.texteVide}>
          Votre compte n'a pas de rôle Évaluateur ou Superviseur. Utilisez l'application web pour vos autres activités.
        </Text>
        <Bouton titre="Se déconnecter" variante="secondaire" onPress={deconnecter} />
      </EcranCentre>
    );
  }

  if (isPending) return <EcranCentre>{entete}<ActivityIndicator size="large" color={couleurs.primaire} /></EcranCentre>;

  return (
    <View style={{ flex: 1 }}>
      {entete}
      <SectionList
        sections={liste}
        keyExtractor={(m) => m._id}
        contentContainerStyle={styles.liste}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[couleurs.primaire]} />}
        ListHeaderComponent={(
          <View style={{ gap: espace.sm, marginBottom: espace.sm }}>
            <Text style={styles.bonjour}>Bonjour {nomComplet(utilisateur)}</Text>
            {error && <Alerte>{messageErreur(error)}</Alerte>}
          </View>
        )}
        renderSectionHeader={({ section }) => <Text style={styles.section}>{section.titre} ({section.data.length})</Text>}
        renderItem={({ item }) => (
          <CarteMission
            mission={item}
            enRetard={Boolean(item.datePrevue) && new Date(item.datePrevue!) < aujourdhui && A_FAIRE.includes(item.evaluation?.statut || 'PLANIFIEE')}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: espace.sm }} />}
        ListEmptyComponent={!error ? (
          <View style={{ paddingVertical: espace.lg, gap: espace.sm }}>
            <Text style={styles.titreVide}>Aucune mission pour le moment</Text>
            <Text style={styles.texteVide}>Vos missions apparaîtront ici quand votre coordonnateur aura démarré une campagne. Tirez vers le bas pour actualiser.</Text>
          </View>
        ) : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  liste: { padding: espace.md, paddingBottom: espace.lg * 2 },
  bonjour: { fontSize: 18, fontWeight: '600', color: couleurs.texte },
  section: { fontSize: 13, fontWeight: '700', color: couleurs.texteSecondaire, textTransform: 'uppercase', marginTop: espace.md, marginBottom: espace.sm },
  titreVide: { fontSize: 17, fontWeight: '600', textAlign: 'center', color: couleurs.texte },
  texteVide: { fontSize: 14, textAlign: 'center', color: couleurs.texteSecondaire },
});
