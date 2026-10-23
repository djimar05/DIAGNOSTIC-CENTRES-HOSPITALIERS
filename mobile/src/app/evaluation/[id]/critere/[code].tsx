import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEvaluation, useGrille } from '@/api/collecte';
import { messageErreur } from '@/api/client';
import type { Reponse } from '@/api/types';
import ChampReponse from '@/composants/saisie/ChampReponse';
import Photos from '@/composants/saisie/Photos';
import { Alerte, EcranCentre, Pastille } from '@/composants/ui';
import * as fileAttente from '@/hors-ligne/fileAttente';
import { fusionnerReponses, useEnAttente } from '@/hors-ligne/SynchroProvider';
import { STATUTS_MODIFIABLES, criteresApplicables, estApplicable, indexer } from '@/logique/grille';
import { couleurs, espace } from '@/theme';

type Brouillon = Required<Pick<Reponse, 'sansObjet' | 'observation' | 'fichiers'>> & { valeur: unknown };
const VIDE: Brouillon = { valeur: null, sansObjet: false, observation: '', fichiers: [] };

/**
 * M5 – Saisie d'un critère : réponse selon le type, « sans objet », photos, observation.
 * Chaque changement est d'abord gardé dans le coffre chiffré du téléphone, puis envoyé au serveur
 * (aussitôt si le réseau le permet, sinon dès son retour).
 */
export default function SaisieCritere() {
  const { id, code } = useLocalSearchParams<{ id: string; code: string }>();
  const { data: evaluation, isPending, error } = useEvaluation(id);
  const { data: grille } = useGrille(evaluation?.grille);
  const enAttente = useEnAttente(id);
  const [brouillon, setBrouillon] = useState<Brouillon>(VIDE);
  const [modifie, setModifie] = useState(false);
  const [erreurLocale, setErreurLocale] = useState<string | null>(null);

  const trouve = useMemo(() => {
    for (const domaine of grille?.domaines || []) {
      const critere = domaine.criteres.find((c) => c.code === code);
      if (critere) return { critere, domaine };
    }
    return null;
  }, [grille, code]);

  // Réponses du serveur complétées par celles encore dans le coffre du téléphone
  const toutes = useMemo(() => fusionnerReponses(evaluation?.reponses, enAttente.reponses), [evaluation, enAttente.reponses]);

  // Brouillon initialisé à partir de la dernière réponse connue, à chaque changement de critère
  useEffect(() => {
    const r = toutes.find((x) => x.critereCode === code);
    setBrouillon(r ? { valeur: r.valeur ?? null, sansObjet: Boolean(r.sansObjet), observation: r.observation || '', fichiers: r.fichiers || [] } : VIDE);
    setModifie(false);
    setErreurLocale(null);
  }, [code, evaluation?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const reponses = useMemo(() => {
    const index = indexer(toutes);
    index.set(code, { critereCode: code, ...brouillon }); // la saisie en cours compte pour les conditions
    return index;
  }, [toutes, brouillon, code]);
  const liste = useMemo(() => (grille ? criteresApplicables(grille, reponses) : []), [grille, reponses]);

  if (isPending || !grille) return <EcranCentre><ActivityIndicator size="large" color={couleurs.primaire} /></EcranCentre>;
  if (error || !evaluation || !trouve) return <EcranCentre><Alerte>{error ? messageErreur(error) : `Critère ${code} introuvable`}</Alerte></EcranCentre>;

  const { critere, domaine } = trouve;
  const modifiable = STATUTS_MODIFIABLES.includes(evaluation.statut);
  const applicable = estApplicable(critere, reponses);
  const position = liste.findIndex((x) => x.critere.code === code);
  const precedent = position > 0 ? liste[position - 1] : null;
  const suivant = position >= 0 && position < liste.length - 1 ? liste[position + 1] : null;
  const preuveExigee = Boolean(critere.preuveExigee && critere.preuveExigee !== 'AUCUNE');

  /** Met à jour le brouillon et le met dans la file d'envoi (coffre chiffré du téléphone). */
  const sauver = (modif: Partial<Brouillon>) => {
    const nouveau = { ...brouillon, ...modif };
    setBrouillon(nouveau);
    if (!modifiable) return;
    setModifie(true);
    setErreurLocale(null);
    fileAttente.ajouterReponse(id, { critereCode: code, ...nouveau })
      .catch((err) => setErreurLocale(`Non enregistré sur le téléphone : ${messageErreur(err)}`));
  };

  // État affiché : d'après la file d'attente (envoyé, en attente de réseau, refusé par le serveur)
  const elementsCritere = enAttente.elements.filter((e) => e.critereCode === code);
  const elementEnAttente = elementsCritere.find((e) => e.type === 'reponse');
  const enErreur = elementsCritere.find((e) => e.erreur); // réponse ou photo dont l'envoi a échoué
  const etat = erreurLocale ? { type: 'erreur', texte: erreurLocale }
    : enErreur?.statut === 'bloque' ? { type: 'erreur', texte: `Refusé par le serveur : ${enErreur.erreur}` }
      : enErreur ? { type: 'erreur', texte: `Enregistré sur le téléphone · envoi ${enErreur.type === 'photo' ? 'de la photo ' : ''}en échec, nouvel essai automatique : ${enErreur.erreur}` }
        : elementEnAttente ? { type: 'encours', texte: 'Enregistré sur le téléphone · envoi en attente' }
          : modifie ? { type: 'ok', texte: 'Envoyé' } : null;
  const aller = (cible: string) => router.replace({ pathname: '/evaluation/[id]/critere/[code]', params: { id, code: cible } });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: `${domaine.code} · ${position >= 0 ? position + 1 : '–'}/${liste.length}` }} />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Text style={styles.domaine}>{domaine.nom}</Text>
        <Text style={styles.libelle}>
          <Text style={styles.code}>{critere.code}  </Text>{critere.libelle}{critere.obligatoire !== false && <Text style={{ color: couleurs.erreur }}> *</Text>}
        </Text>
        <View style={styles.badges}>
          {critere.eliminatoire && <Pastille texte="Éliminatoire" couleur={couleurs.erreur} />}
          {preuveExigee && <Pastille texte={critere.preuveExigee === 'PHOTO' ? 'Photo exigée' : 'Document exigé (photo)'} couleur="#1c7ed6" />}
          {critere.obligatoire === false && <Pastille texte="Facultatif" couleur={couleurs.texteSecondaire} />}
        </View>
        {critere.aide ? <Alerte type="info">{critere.aide}</Alerte> : null}

        {!applicable ? (
          <Alerte type="info">Ce critère ne s'applique pas ici (il dépend de la réponse à {critere.condition?.critere}).</Alerte>
        ) : (
          <>
            {critere.sansObjetAutorise && (
              <View style={styles.sansObjet}>
                <Text style={styles.texteSansObjet}>Sans objet pour ce centre</Text>
                <Switch value={brouillon.sansObjet} disabled={!modifiable} onValueChange={(v) => sauver({ sansObjet: v, valeur: v ? null : brouillon.valeur })} trackColor={{ true: couleurs.primaire }} />
              </View>
            )}
            {!brouillon.sansObjet && (
              <ChampReponse critere={critere} valeur={brouillon.valeur} onChange={(valeur) => sauver({ valeur })} desactive={!modifiable} />
            )}
            {!brouillon.sansObjet && (
              <Photos
                evaluationId={id}
                critereCode={code}
                fichiers={brouillon.fichiers}
                onChange={(fichiers) => sauver({ fichiers })}
                desactive={!modifiable}
                exigee={preuveExigee}
              />
            )}
            <View style={{ gap: espace.xs }}>
              <Text style={styles.sousTitre}>Observation</Text>
              <TextInput
                style={styles.observation}
                multiline
                editable={modifiable}
                value={brouillon.observation}
                onChangeText={(observation) => setBrouillon({ ...brouillon, observation })}
                onBlur={() => {
                  const enregistree = toutes.find((r) => r.critereCode === code)?.observation || '';
                  if (brouillon.observation !== enregistree) sauver({});
                }}
                placeholder="Constat, précision utile au superviseur…"
                placeholderTextColor="#adb5bd"
              />
            </View>
          </>
        )}

        {etat && <Text style={[styles.etat, etat.type === 'erreur' && { color: couleurs.erreur }, etat.type === 'ok' && { color: couleurs.succes }]}>{etat.texte}</Text>}
      </ScrollView>

      <View style={styles.navigation}>
        <Pressable onPress={() => precedent && aller(precedent.critere.code)} disabled={!precedent} style={[styles.boutonNav, !precedent && { opacity: 0.4 }]} accessibilityRole="button">
          <Text style={styles.texteNav}>‹ Précédent</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={styles.boutonNav} accessibilityRole="button">
          <Text style={styles.texteNav}>Sommaire</Text>
        </Pressable>
        <Pressable
          onPress={() => (suivant ? aller(suivant.critere.code) : router.replace({ pathname: '/evaluation/[id]/recapitulatif', params: { id } }))}
          style={[styles.boutonNav, styles.boutonSuivant]}
          accessibilityRole="button"
        >
          <Text style={[styles.texteNav, { color: '#fff' }]}>{suivant ? 'Suivant ›' : 'Récapitulatif ›'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { padding: espace.md, gap: espace.md, paddingBottom: espace.lg * 2 },
  domaine: { fontSize: 13, fontWeight: '700', color: couleurs.texteSecondaire, textTransform: 'uppercase' },
  libelle: { fontSize: 19, fontWeight: '600', color: couleurs.texte, lineHeight: 26 },
  code: { fontSize: 13, color: couleurs.texteSecondaire, fontWeight: '500' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: espace.xs },
  sansObjet: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: espace.md, borderWidth: 1, borderColor: couleurs.bordure },
  texteSansObjet: { fontSize: 15, color: couleurs.texte },
  sousTitre: { fontSize: 15, fontWeight: '600', color: couleurs.texte },
  observation: { minHeight: 70, borderWidth: 1, borderColor: couleurs.bordure, borderRadius: 8, backgroundColor: '#fff', padding: espace.sm, fontSize: 15, textAlignVertical: 'top', color: couleurs.texte },
  etat: { fontSize: 13, color: couleurs.texteSecondaire, textAlign: 'center' },
  navigation: { flexDirection: 'row', gap: espace.sm, padding: espace.sm, borderTopWidth: 1, borderColor: couleurs.bordure, backgroundColor: '#fff' },
  boutonNav: { flex: 1, minHeight: 48, borderRadius: 8, borderWidth: 1, borderColor: couleurs.primaire, alignItems: 'center', justifyContent: 'center' },
  boutonSuivant: { backgroundColor: couleurs.primaire },
  texteNav: { fontSize: 15, fontWeight: '600', color: couleurs.primaire },
});
