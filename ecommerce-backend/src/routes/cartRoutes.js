const router = require('express').Router();
const c = require('../controllers/cartController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(protect, authorize('customer'));
router.get('/', c.getCart);
router.delete('/', c.clear);
router.post('/items', validate({ productId: { required: true, type: 'string' }, quantity: { required: true, type: 'number', min: 1 } }), c.addItem);
router.patch('/items/:productId', validate({ quantity: { required: true, type: 'number', min: 1 } }), c.updateItem);
router.delete('/items/:productId', c.removeItem);

module.exports = router;
