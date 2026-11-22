const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const eventBus = require('../events/eventBus');

/**
 * Socket.IO setup.
 * - Authentication: client passes its JWT access token in the handshake (auth.token).
 * - Rooms: every user joins "user:<id>"; admins also join "admins".
 * - EventEmitter -> Socket.IO bridge: business events from eventBus are pushed to the right rooms.
 *
 * Server -> client events:
 *   order:placed  (customer)        { orderId, total }
 *   order:new     (sellers/admins)  { orderId, customer, items }
 *   order:status  (customer)        { orderId, status }
 *   stock:low     (seller + admins) { productId, name, stock }
 */
module.exports = (httpServer) => {
  const io = new Server(httpServer, { cors: { origin: '*' } });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));
      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      socket.user = { id: payload.id, role: payload.role };
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user.id}`);
    if (socket.user.role === 'admin') socket.join('admins');
    socket.emit('connected', { message: 'Socket authenticated', role: socket.user.role });
  });

  eventBus.on('order.placed', ({ orderId, customer, total, sellers, items }) => {
    io.to(`user:${customer}`).emit('order:placed', { orderId, total });
    sellers.forEach((s) => io.to(`user:${s}`).emit('order:new', { orderId, customer, items }));
    io.to('admins').emit('order:new', { orderId, customer, items });
  });

  eventBus.on('order.statusChanged', ({ orderId, customer, status }) => {
    io.to(`user:${customer}`).emit('order:status', { orderId, status });
  });

  eventBus.on('stock.low', ({ productId, name, stock, seller }) => {
    io.to(`user:${seller}`).to('admins').emit('stock:low', { productId, name, stock });
  });

  return io;
};
