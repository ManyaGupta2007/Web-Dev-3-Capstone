const router = require('express').Router();
const c = require('../controllers/wishlistController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('customer'));
router.get('/', c.get);
router.post('/:productId', c.add);
router.delete('/:productId', c.remove);

module.exports = router;
