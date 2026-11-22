const router = require('express').Router();
const c = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.post('/register', validate({ name: { required: true, type: 'string' }, email: { required: true, type: 'string' }, password: { required: true, type: 'string', } }), c.register);
router.post('/login', validate({ email: { required: true, type: 'string' }, password: { required: true, type: 'string' } }), c.login);
router.post('/refresh', c.refresh);
router.post('/logout', protect, c.logout);

module.exports = router;
