#!/usr/bin/env node

import createDebugger from "debug";
import http from "node:http";
import wsServer from "../services/wsserver.js";

import app from "../app.js";

const debug = createDebugger('essai-express:server')

// Get port from environment and store in Express
const port = normalizePort(process.env.PORT || "3000");
app.set("port", port);

// Create HTTP server
const httpServer = http.createServer(app);

// create 

// Listen on provided port, on all network interfaces
httpServer.listen(port);
httpServer.on("error", onHttpServerError);
httpServer.on("listening", onHttpServerListening);

// Start WebSocket server
httpServer.on("upgrade", (request, socket, head) => {
  
  wsServer.handleUpgrade(request, socket, head, function done(ws) {
    wsServer.emit("connection", ws, request);
  });
}
);


// Normalize a port into a number, string, or false
function normalizePort(val) {
  const port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

function onHttpServerError(error) {
  if (error.syscall !== "listen") {
    throw error;
  }

  const bind = typeof port === "string" ? `Pipe ${port}` : `Port ${port}`;

  // Handle specific listen errors with friendly messages
  switch (error.code) {
    case "EACCES":
      console.error(`${bind} requires elevated privileges`);
      process.exit(1);
    case "EADDRINUSE":
      console.error(`${bind} is already in use`);
      process.exit(1);
    default:
      throw error;
  }
}

function onHttpServerListening() {
  const addr = httpServer.address();
  const bind = typeof addr === "string" ? `pipe ${addr}` : `port ${addr.port}`;
  debug(`Listening on ${bind}`);
}
