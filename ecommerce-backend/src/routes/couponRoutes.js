const router = require('express').Router();
const c = require('../controllers/couponController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(protect);
router.post('/validate', authorize('customer'), validate({ code: { required: true, type: 'string' } }), c.validate);
router.get('/', authorize('admin'), c.list);
router.post('/', authorize('admin'), validate({ code: { required: true, type: 'string' }, discountPercent: { required: true, type: 'number', min: 1 }, expiresAt: { required: true, type: 'string' } }), c.create);
router.delete('/:id', authorize('admin'), c.remove);

module.exports = router;
