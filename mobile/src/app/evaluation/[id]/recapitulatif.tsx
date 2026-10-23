import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEvaluation, useSoumettre, useVerification } from '@/api/collecte';
import { messageErreur } from '@/api/client';
import type { ElementManquant } from '@/api/types';
import { Alerte, Bouton, EcranCentre } from '@/composants/ui';
import * as fileAttente from '@/hors-ligne/fileAttente';
import { useEnAttente } from '@/hors-ligne/SynchroProvider';
import { STATUTS_MODIFIABLES } from '@/logique/grille';
import { couleurs, espace } from '@/theme';

/**
 * M6 – Récapitulatif avant soumission : réponses obligatoires et preuves manquantes, puis envoi.
 * Tant que des saisies attendent dans le coffre du téléphone, l'envoi au superviseur est bloqué.
 */
export default function Recapitulatif() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: evaluation } = useEvaluation(id);
  const { data: verif, isPending, error, refetch, isRefetching } = useVerification(id);
  const soumettre = useSoumettre(id);
  const enAttente = useEnAttente(id);

  if (isPending) return <EcranCentre><ActivityIndicator size="large" color={couleurs.primaire} /></EcranCentre>;
  if (error || !verif) return <EcranCentre><Alerte>{messageErreur(error)}</Alerte></EcranCentre>;

  const modifiable = evaluation ? STATUTS_MODIFIABLES.includes(evaluation.statut) : false;
  const total = verif.progression.reduce((s, p) => s + p.total, 0);
  const repondus = verif.progression.reduce((s, p) => s + p.repondus, 0);
  const ouvrir = (code: string) => router.push({ pathname: '/evaluation/[id]/critere/[code]', params: { id, code } });

  const envoyer = () => Alert.alert(
    'Envoyer l\'évaluation ?',
    'Elle sera transmise au superviseur et ne sera plus modifiable, sauf s\'il vous la renvoie pour correction.',
    [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Envoyer',
        onPress: () => soumettre.mutate(undefined, {
          onSuccess: () => {
            Alert.alert('Évaluation envoyée', 'Merci ! Le superviseur va la relire.');
            router.dismissTo('/');
          },
          onError: (err) => Alert.alert('Envoi impossible', messageErreur(err)),
        }),
      },
    ],
  );

  const Liste = ({ titre, elements, detail }: { titre: string; elements: ElementManquant[]; detail: (e: ElementManquant) => string }) => (
    elements.length ? (
      <View style={styles.carte}>
        <Text style={styles.sousTitre}>{titre} ({elements.length})</Text>
        {elements.map((e) => (
          <Pressable key={`${titre}-${e.critereCode}`} onPress={() => ouvrir(e.critereCode)} style={styles.ligne} accessibilityRole="button">
            <Text style={styles.code}>{e.critereCode}</Text>
            <Text style={styles.texteLigne} numberOfLines={2}>{e.libelle} · {detail(e)}</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </View>
    ) : null
  );

  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}>
      <View style={styles.carte}>
        <Text style={styles.sousTitre}>{repondus} / {total} critères renseignés</Text>
        {verif.progression.map((p) => (
          <View key={p.domaineCode} style={styles.domaine}>
            <Text style={styles.nomDomaine} numberOfLines={1}>{p.nom}</Text>
            <Text style={[styles.compte, p.repondus === p.total && { color: couleurs.succes }]}>{p.repondus}/{p.total}</Text>
          </View>
        ))}
      </View>

      {enAttente.total > 0 && (
        <View style={styles.carte}>
          <Text style={styles.sousTitre}>À envoyer ({enAttente.total})</Text>
          <Text style={styles.texteLigne}>
            Ces saisies sont gardées sur le téléphone et partiront dès que possible. Le récapitulatif ci-dessous n'en tient compte qu'une fois envoyées.
          </Text>
          {[...enAttente.bloques, ...enAttente.enEchec].map((e) => (
            <Text key={e.id} style={[styles.texteLigne, { color: couleurs.erreur }]}>
              {e.critereCode} · {e.type === 'photo' ? 'photo' : 'réponse'} {e.statut === 'bloque' ? 'refusée par le serveur' : 'non envoyée'} : {e.erreur}
            </Text>
          ))}
          <Bouton
            titre={enAttente.bloques.length ? 'Réessayer' : 'Envoyer maintenant'}
            variante="secondaire"
            onPress={() => (enAttente.bloques.length ? fileAttente.reessayerBloques() : fileAttente.envoyer()).then(() => refetch())}
          />
        </View>
      )}

      {verif.complet
        ? <Alerte type="info">Tout est renseigné : l'évaluation peut être envoyée.</Alerte>
        : <Alerte type="alerte">Complétez les éléments ci-dessous avant d'envoyer (touchez une ligne pour y aller).</Alerte>}

      <Liste titre="Réponses manquantes" elements={verif.manquants} detail={() => 'réponse obligatoire'} />
      <Liste titre="Preuves manquantes" elements={verif.preuvesManquantes} detail={(e) => (e.preuve === 'DOCUMENT' ? 'photo du document exigée' : 'photo exigée')} />
      {verif.erreurs.length > 0 && <Alerte>{verif.erreurs.join('\n')}</Alerte>}

      {modifiable
        ? <Bouton titre="Envoyer au superviseur" onPress={envoyer} desactive={!verif.complet || enAttente.total > 0} chargement={soumettre.isPending} />
        : <Alerte type="info">Évaluation déjà envoyée.</Alerte>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: espace.md, gap: espace.md, paddingBottom: espace.lg * 2 },
  carte: { backgroundColor: couleurs.carte, borderRadius: 10, padding: espace.md, gap: espace.sm, borderWidth: 1, borderColor: couleurs.bordure },
  sousTitre: { fontSize: 16, fontWeight: '600', color: couleurs.texte },
  domaine: { flexDirection: 'row', justifyContent: 'space-between', gap: espace.md },
  nomDomaine: { fontSize: 14, color: couleurs.texte, flexShrink: 1 },
  compte: { fontSize: 14, fontWeight: '600', color: couleurs.texteSecondaire },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace.sm, paddingVertical: espace.sm, borderTopWidth: 1, borderColor: couleurs.bordure },
  code: { fontSize: 13, fontWeight: '700', color: couleurs.primaire, width: 60 },
  texteLigne: { flex: 1, fontSize: 14, color: couleurs.texte },
  chevron: { fontSize: 22, color: couleurs.texteSecondaire },
});
