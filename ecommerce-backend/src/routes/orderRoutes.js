const router = require('express').Router();
const c = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(protect);
router.post('/', authorize('customer'), c.placeOrder);
router.get('/', c.list);
router.get('/:id', c.getOne);
router.patch('/:id/status', authorize('seller', 'admin'),
  validate({ status: { required: true, type: 'string', enum: ['confirmed', 'shipped', 'delivered', 'cancelled'] } }), c.updateStatus);
router.post('/:id/cancel', authorize('customer'), c.cancel);

module.exports = router;
