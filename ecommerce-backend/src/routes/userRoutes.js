const router = require('express').Router();
const c = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.get('/me', protect, c.me);
router.patch('/me', protect, c.updateMe);

module.exports = router;
