const express = require('express');
const router = express.Router();
const serversController = require('../controllers/serversController');
const { protect, restrictTo } = require('../middleware/auth');

// All routes are restricted to admin users only
router.use(protect);
router.use(restrictTo('admin'));

router.route('/')
    .get(serversController.getServers)
    .post(serversController.createServer);

router.route('/:id')
    .get(serversController.getServer)
    .put(serversController.updateServer)
    .delete(serversController.deleteServer);

router.route('/:id/test').post(serversController.testServer);
router.route('/:id/health').patch(serversController.updateHealthStatus);

module.exports = router;