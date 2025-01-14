#!/bin/bash

# Installation des dépendances
echo "Installation des dépendances..."
npm install

# Peuplement de la base de données
echo "Peuplement de la base de données..."
npm run seed

echo "Configuration initiale terminée. Vous pouvez maintenant exécuter npm run dev pour démarrer le serveur de développement."