const router = require('express').Router();
const c = require('../controllers/productController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const reviews = require('../controllers/reviewController');

router.get('/', c.list);
router.get('/mine', protect, authorize('seller'), c.mine); // must be before '/:id'
router.get('/:id', c.getOne);
router.get('/:id/reviews', reviews.list);
router.post('/:id/reviews', protect, authorize('customer'), validate({ rating: { required: true, type: 'number', min: 1 } }), reviews.add);
router.post('/', protect, authorize('seller', 'admin'),
  validate({ name: { required: true, type: 'string' }, price: { required: true, type: 'number', min: 0 }, stock: { required: true, type: 'number', min: 0 }, category: { required: true, type: 'string' } }),
  c.create);
router.patch('/:id', protect, authorize('seller', 'admin'), c.update);
router.delete('/:id', protect, authorize('seller', 'admin'), c.remove);

module.exports = router;
