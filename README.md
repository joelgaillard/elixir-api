# Elixir API

## Description
Elixir API est une api RESTful de niveau 2 gérant utilisateurs, cocktails et bars. Développée avec **Express.js et MongoDB**, elle inclut l'authentification JWT, la pagination, la géolocalisation, et la gestion des images.

## Installation du projet en local
Pour exécuter ce projet localement, assurez-vous que votre environnement de développement inclue les éléments suivants :
- Node.js (v23 ou supérieur)
- npm
- MongoDB

### Étape 1: Clonage du dépôt
Clonez ce dépôt sur votre machine locale en utilisant :

```bash
git clone https://github.com/joelgaillard/elixir-api.git
cd elixir-api
```

### Étape 2: Configuration de l'environnement
Dupliquez le fichier `.env.example` pour créer un fichier `.env` que vous devrez configurer selon votre environnement de développement.

```bash
cp .env.example .env
```

### Étape 3: Configuration initiale
Rendez le script de configuration exécutable et exécutez-le.

```bash
chmod +x setup.sh
./setup.sh
```

### Étape 4: Lancement du serveur de développement
Démarrer le serveur de développement: 

```bash
npm run dev
```





