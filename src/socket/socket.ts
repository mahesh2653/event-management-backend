import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';

let io: Server;

/**
 * Each authenticated socket joins a room named `user:<userId>`.
 * When a user logs in from a new browser, the auth controller calls
 * emitForceLogout(userId, newSessionId) which tells every OTHER socket
 * in that room (i.e. the old browser tab) to log itself out immediately.
 */
export function initSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || '*',
      credentials: true,
    },
  });

  io.use((socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('Unauthorized: no token'));
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.userId;
      socket.data.sessionId = payload.sessionId;
      next();
    } catch (err) {
      next(new Error('Unauthorized: invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);

    socket.on('disconnect', () => {
      // no-op; room membership cleans up automatically
    });
  });

  return io;
}

export function emitForceLogout(userId: string, newSessionId: string) {
  if (!io) return;
  io.to(`user:${userId}`).emit('force-logout', {
    reason: 'You have logged in from another browser/device.',
    newSessionId,
  });
}

export function getIo(): Server {
  return io;
}
