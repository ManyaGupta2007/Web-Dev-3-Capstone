const EventEmitter = require('events');

/**
 * Application-wide EventEmitter.
 * Controllers EMIT business events (order.placed, order.statusChanged, stock.low).
 * Listeners (socket notifications, logging) react WITHOUT the controller knowing about them.
 * This keeps business logic decoupled from the notification mechanism.
 */
class AppEvents extends EventEmitter {}
const eventBus = new AppEvents();

eventBus.on('order.placed', (o) => console.log(`[event] order.placed order=${o.orderId} total=${o.total}`));
eventBus.on('order.statusChanged', (o) => console.log(`[event] order.statusChanged order=${o.orderId} -> ${o.status}`));
eventBus.on('stock.low', (p) => console.log(`[event] stock.low product="${p.name}" stock=${p.stock}`));

module.exports = eventBus;
