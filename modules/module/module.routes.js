// modules/module/module.routes.js
// Module routes

const express = require('express');
const router = express.Router();
const moduleController = require('./module.controller');
const { authenticate } = require('../../middlewares/auth.middleware');

// All module routes require authentication
router.use(authenticate);

// GET /modules - Fetch all modules (Super Admin only for now)
router.get('/', moduleController.getAllModules);

// GET /modules/:id - Fetch single module
router.get('/:id', moduleController.getModuleById);

module.exports = router;
