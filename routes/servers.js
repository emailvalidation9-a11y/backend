const express = require('express');
const router = express.Router();
const serversController = require('../controllers/serversController');
const { protect, restrictTo } = require('../middleware/auth');
const { validateCreateServer, validateUpdateServer, validate, stripUnknownFields } = require('../utils/validation');

// All routes are restricted to admin users only
router.use(protect);
router.use(restrictTo('admin'));

router.route('/')
    .get(serversController.getServers)
    .post(stripUnknownFields(['name', 'url', 'weight']), validateCreateServer, validate, serversController.createServer);

router.route('/:id')
    .get(serversController.getServer)
    .put(stripUnknownFields(['name', 'url', 'weight', 'isActive']), validateUpdateServer, validate, serversController.updateServer)
    .delete(serversController.deleteServer);

router.route('/:id/test').post(serversController.testServer);
router.route('/:id/health').patch(stripUnknownFields(['isHealthy', 'lastChecked', 'responseTime']), serversController.updateHealthStatus);

module.exports = router;
