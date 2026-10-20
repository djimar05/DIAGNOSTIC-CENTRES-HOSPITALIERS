# Modèle de données – Application de diagnostic des centres hospitaliers

**Base de données :** MongoDB (schémas Mongoose)

## Principes

- **Droits par affectation** : les droits passent par une *Affectation*, qui associe un rôle à un périmètre (national, région, district ou centre).
- **Grilles versionnées** : une grille publiée est figée ; toute modification crée une nouvelle version.
- **Historique fiable** : chaque réponse d'évaluation garde une copie du libellé et du barème du critère.
- **Fichiers hors base** : les photos et preuves sont stockées dans un stockage objet ; la base ne garde que leurs métadonnées.
- **Synchronisation hors ligne** : les identifiants `clientId` (UUID générés sur le téléphone) permettent de synchroniser sans créer de doublons.

## Enchaînement général

```
Zone → Centre
Grille (domaines → critères) → Campagne → Mission (un centre à visiter)
Mission → Evaluation (réponses + scores) → ActionCorrective (écarts à corriger)
Utilisateur → Affectation (ce qu'il a le droit de voir et de faire)
```

## Conventions des exemples

Dans les exemples (commentaires en tête de chaque fichier de `models/`), les ObjectId sont abrégés en `ObjectId(...)` avec un nom lisible (ex. `ObjectId("zone_district_a")`) pour faciliter la lecture. En base, ce sont de vrais ObjectId.