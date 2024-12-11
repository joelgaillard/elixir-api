import {WebSocketServer} from 'ws';

const wsServer = new WebSocketServer({ noServer: true });

wsServer.on('connection', (ws) => {
    console.log('Un utilisateur est connecté');
});

export default wsServer;