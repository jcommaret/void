# Utilisation des Workflows GitHub Actions

Ce document explique comment utiliser les workflows GitHub Actions pour builder et tester le projet Void.

## Table des Matières

1. [Exécution des Workflows](#exécution-des-workflows)
2. [Workflow Principal (build.yml)](#workflow-principal-buildyml)
3. [Build de la CLI](#build-de-la-cli)
4. [Build des Extensions](#build-des-extensions)
5. [Build Web](#build-web)
6. [Publication des Artifacts](#publication-des-artifacts)
7. [Analyse CodeQL](#analyse-codeql)
8. [Triage des Issues](#triage-des-issues)
9. [Exécution Locale](#exécution-locale)
10. [Dépannage](#dépannage)

## Exécution des Workflows

### Déclenchement Automatique

Tous les workflows sont configurés pour s'exécuter automatiquement dans les cas suivants :

- **Push** sur la branche `master`
- **Pull Request** vers la branche `master`
- **Planifié** (pour certains workflows comme `triage.yml` et `codeql-analysis.yml`)

### Déclenchement Manuel

Vous pouvez déclencher manuellement n'importe quel workflow :

1. Allez dans l'onglet **Actions** de votre dépôt GitHub
2. Sélectionnez le workflow que vous souhaitez exécuter
3. Cliquez sur le bouton **Run workflow**
4. Cliquez sur **Run workflow** à nouveau pour confirmer

## Workflow Principal (build.yml)

Ce workflow est le cœur du processus de build et de test.

### Jobs disponibles :

- **compile** : Compile le projet
- **test-unit** : Exécute les tests unitaires sur Linux
- **test-browser** : Exécute les tests navigateur
- **lint** : Exécute ESLint et Stylelint
- **hygiene** : Exécute les vérifications d'hygiène

### Comment utiliser :

```bash
# Pour voir les résultats des builds
cd /Users/jcommaret/Sites/void
npm run compile

# Pour exécuter les tests unitaires
npm run test-node

# Pour exécuter les tests navigateur
npm run playwright-install
npm run test-browser

# Pour exécuter le linting
npm run eslint
npm run stylelint

# Pour exécuter les vérifications d'hygiène
npm run hygiene
```

## Build de la CLI

La CLI est écrite en Rust et peut être buildée sur différentes plateformes.

### Build sur Linux/macOS/Windows :

```bash
cd cli
cargo build --release
```

### Exécution des tests :

```bash
cd cli
cargo test
```

### Build multi-plateforme :

Le workflow `build-cli-matrix.yml` build la CLI sur :
- Ubuntu 22.04
- macOS 12
- Windows 2022

## Build des Extensions

Les extensions sont buildées séparément pour permettre une mise à jour indépendante.

### Comment build les extensions :

```bash
npm run compile-extensions-build
```

## Build Web

La version web de Void peut être buildée séparément.

### Comment build la version web :

```bash
npm run compile-web
```

## Publication des Artifacts

Le workflow `publish-artifacts.yml` compile tous les composants et les package pour distribution.

### Comment exécuter manuellement :

1. Allez dans l'onglet **Actions**
2. Sélectionnez **Publish Build Artifacts**
3. Cliquez sur **Run workflow**

### Artifacts produits :

- `out/` : Build principal
- `void-cli-linux` : Binaire CLI pour Linux
- `out-vscode/` : Build web

## Analyse CodeQL

Le workflow `codeql-analysis.yml` effectue une analyse statique du code pour détecter les problèmes de sécurité et de qualité.

### Comment voir les résultats :

1. Allez dans l'onglet **Security** de votre dépôt
2. Sélectionnez **Code scanning**
3. Vous verrez les alertes détectées par CodeQL

## Triage des Issues

Le workflow `triage.yml` utilise l'IA pour trier automatiquement les issues GitHub.

### Comment configurer :

Vous devez configurer les secrets suivants dans votre dépôt :
- `OPENAI_API_KEY` : Clé API OpenAI
- `WIKI_TOKEN` : Token GitHub avec accès wiki

### Comment exécuter manuellement :

1. Allez dans l'onglet **Actions**
2. Sélectionnez **Issue Triage to Wiki**
3. Cliquez sur **Run workflow**

## Exécution Locale

Vous pouvez tester les workflows localement en utilisant `act` (GitHub Actions runner).

### Installation :

```bash
brew install act
```

### Exécution d'un workflow :

```bash
act -j build
```

### Exécution de tous les workflows :

```bash
act
```

## Dépannage

### Problème : Le workflow ne se déclenche pas

**Solutions** :
1. Vérifiez que le workflow est bien dans `.github/workflows/`
2. Vérifiez la section `on` du workflow YAML
3. Vérifiez que le workflow n'est pas désactivé dans les paramètres du dépôt
4. Vérifiez que vous avez les permissions nécessaires

### Problème : Le workflow échoue

**Solutions** :
1. Vérifiez les logs du workflow pour voir où il échoue
2. Vérifiez que toutes les dépendances sont installées
3. Vérifiez que les variables d'environnement sont correctement configurées
4. Vérifiez que vous avez assez d'espace disque
5. Vérifiez que vous avez assez de mémoire

### Problème : Le workflow prend trop de temps

**Solutions** :
1. Vérifiez que tous les jobs ont des timeouts configurés
2. Vérifiez qu'il n'y a pas de boucles infinies dans le code
3. Vérifiez que les dépendances sont bien cachées
4. Vérifiez que vous n'avez pas de processus qui s'exécutent indéfiniment

### Problème : Les artifacts ne sont pas disponibles

**Solutions** :
1. Vérifiez que le job qui produit les artifacts a réussi
2. Vérifiez que les artifacts sont bien configurés dans le workflow
3. Vérifiez que vous avez les permissions pour télécharger les artifacts
4. Vérifiez que les artifacts n'ont pas expiré (durée de conservation par défaut : 30 jours)

## Bonnes Pratiques

1. **Commitez souvent** : Plus vous commitez souvent, plus les workflows s'exécutent souvent, ce qui permet de détecter les problèmes plus tôt
2. **Utilisez des branches de feature** : Créez des branches de feature pour développer de nouvelles fonctionnalités et utilisez des pull requests pour les fusionner
3. **Vérifiez les workflows avant de fusionner** : Assurez-vous que tous les workflows passent avant de fusionner une pull request
4. **Nettoyez les artifacts** : Supprimez les artifacts inutiles pour économiser de l'espace de stockage
5. **Documentez les changements** : Documentez les changements apportés aux workflows dans les pull requests

## Ressources

- [Documentation GitHub Actions](https://docs.github.com/en/actions)
- [Marketplace GitHub Actions](https://github.com/marketplace?type=actions)
- [act - Run GitHub Actions locally](https://github.com/nektos/act)
- [CodeQL Documentation](https://codeql.github.com/docs/)
