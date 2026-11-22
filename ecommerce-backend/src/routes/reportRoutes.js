const router = require('express').Router();
const c = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('seller', 'admin'));
router.get('/sales', c.salesSummary);
router.get('/best-sellers', c.bestSellers);
router.get('/inventory', c.inventorySummary);
router.get('/low-stock', c.lowStock);

module.exports = router;
