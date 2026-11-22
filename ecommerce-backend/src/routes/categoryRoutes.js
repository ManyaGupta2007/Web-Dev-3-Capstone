const router = require('express').Router();
const c = require('../controllers/categoryController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.get('/', c.list);
router.post('/', protect, authorize('admin'), validate({ name: { required: true, type: 'string' } }), c.create);
router.patch('/:id', protect, authorize('admin'), c.update);
router.delete('/:id', protect, authorize('admin'), c.remove);

module.exports = router;
