import { useMemo } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useMesMissions } from '@/api/collecte';
import { messageErreur } from '@/api/client';
import type { Mission } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import CarteMission from '@/composants/CarteMission';
import { Alerte, Bouton, EcranCentre } from '@/composants/ui';
import * as fileAttente from '@/hors-ligne/fileAttente';
import { useFileAttente } from '@/hors-ligne/SynchroProvider';
import { couleurs, espace } from '@/theme';
import { debutDuJour, nomComplet } from '@/utils/format';

const statutDe = (m: Mission) => m.evaluation?.statut || 'PLANIFIEE';
const estEnRetard = (m: Mission) => statutDe(m) === 'PLANIFIEE' && Boolean(m.datePrevue) && new Date(m.datePrevue!) < debutDuJour();

/** Répartit les missions par ce que l'évaluateur doit en faire. */
const sections = (missions: Mission[]) => [
  { titre: 'Renvoyées pour correction', data: missions.filter((m) => statutDe(m) === 'A_CORRIGER') },
  { titre: 'En cours', data: missions.filter((m) => statutDe(m) === 'EN_COURS') },
  { titre: 'En retard', data: missions.filter(estEnRetard) },
  { titre: 'À venir', data: missions.filter((m) => statutDe(m) === 'PLANIFIEE' && m.datePrevue && !estEnRetard(m)) },
  { titre: 'Date à fixer', data: missions.filter((m) => statutDe(m) === 'PLANIFIEE' && !m.datePrevue) },
  { titre: 'Envoyées', data: missions.filter((m) => ['SOUMISE', 'VALIDEE', 'PUBLIEE'].includes(statutDe(m))) },
].filter((s) => s.data.length);

/** M2 – Mes missions : visites à faire, en cours, renvoyées, envoyées. */
export default function MesMissions() {
  const { utilisateur, deconnecter, aLeRole } = useAuth();
  const { data, isPending, error, refetch, isRefetching } = useMesMissions();
  const liste = useMemo(() => sections(data?.missions || []), [data]);
  const file = useFileAttente();
  const parEvaluation = useMemo(() => {
    const compte = new Map<string, number>();
    file.forEach((e) => compte.set(e.evaluationId, (compte.get(e.evaluationId) || 0) + 1));
    return compte;
  }, [file]);
  const bloques = file.filter((e) => e.statut === 'bloque');

  const confirmerDeconnexion = () => Alert.alert(
    'Se déconnecter ?',
    file.length
      ? `Attention : ${file.length} saisie(s) pas encore envoyée(s) seront perdues. Envoyez-les d'abord si possible.`
      : 'Vous devrez saisir à nouveau votre mot de passe et choisir un code PIN.',
    [
      { text: 'Annuler', style: 'cancel' },
      { text: file.length ? 'Se déconnecter quand même' : 'Se déconnecter', style: 'destructive', onPress: deconnecter },
    ],
  );
  const entete = (
    <Stack.Screen options={{
      headerRight: () => (
        <Pressable onPress={confirmerDeconnexion} hitSlop={8} accessibilityRole="button">
          <Text style={{ color: couleurs.primaire, fontWeight: '600' }}>Déconnexion</Text>
        </Pressable>
      ),
    }} />
  );

  // La collecte est faite par les évaluateurs
  if (!aLeRole('EVALUATEUR')) {
    return (
      <EcranCentre>
        {entete}
        <Text style={styles.titreVide}>Application réservée aux évaluateurs</Text>
        <Text style={styles.texteVide}>
          Votre compte n'a pas le rôle Évaluateur. Superviseurs et coordonnateurs : utilisez l'application web pour suivre et valider les évaluations.
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
            {file.length > 0 && (
              <View style={styles.aEnvoyer}>
                <Text style={styles.texteAEnvoyer}>
                  {bloques.length
                    ? `${bloques.length} saisie(s) refusée(s) par le serveur (ouvrez la mission concernée).`
                    : `${file.length} saisie(s) enregistrée(s) sur le téléphone, en attente d'envoi. L'envoi reprend automatiquement.`}
                </Text>
                <Bouton
                  titre={bloques.length ? 'Réessayer' : 'Envoyer maintenant'}
                  variante="secondaire"
                  onPress={() => (bloques.length ? fileAttente.reessayerBloques() : fileAttente.envoyer())}
                />
              </View>
            )}
          </View>
        )}
        renderSectionHeader={({ section }) => <Text style={styles.section}>{section.titre} ({section.data.length})</Text>}
        renderItem={({ item }) => (
          <CarteMission mission={item} enRetard={estEnRetard(item)} aEnvoyer={item.evaluation ? parEvaluation.get(item.evaluation._id) : 0} />
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
  aEnvoyer: { backgroundColor: couleurs.alerteClair, borderColor: couleurs.alerte, borderWidth: 1, borderRadius: 10, padding: espace.md, gap: espace.sm },
  texteAEnvoyer: { fontSize: 14, color: couleurs.alerte },
  section: { fontSize: 13, fontWeight: '700', color: couleurs.texteSecondaire, textTransform: 'uppercase', marginTop: espace.md, marginBottom: espace.sm },
  titreVide: { fontSize: 17, fontWeight: '600', textAlign: 'center', color: couleurs.texte },
  texteVide: { fontSize: 14, textAlign: 'center', color: couleurs.texteSecondaire },
});
