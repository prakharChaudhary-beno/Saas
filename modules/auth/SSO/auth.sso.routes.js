const express = require('express');
const router = express.Router();
const ssoController = require('./auth.sso.controller');
const { authenticate } = require('../../../middlewares/auth.middleware');
const validate = require('../../../middlewares/validate.middleware');
const Joi = require('joi');

// ─── Validation Schemas ──────────────────────────────────────────────────────

const ssoLoginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  })
});

const checkDomainSchema = Joi.object({
  domain: Joi.string().required().messages({
    'any.required': 'Domain is required'
  })
});

const configureSsoSchema = Joi.object({
  orgId: Joi.string().required(),
  connectionId: Joi.string().required(),
  domain: Joi.string().optional()
});

// ─── Public SSO Routes ────────────────────────────────────────────────────────

// Initiate SSO by org ID
router.get('/login/:orgId', ssoController.ssoLoginByOrg);

// Initiate SSO by email
router.post('/login', validate(ssoLoginSchema), ssoController.ssoLoginByEmail);

// Check if domain has SSO configured (for AuthKit embed)
router.post('/check-domain', validate(checkDomainSchema), ssoController.checkSSODomain);

// SSO Callback (WorkOS redirects here)
router.get('/callback', ssoController.ssoCallback);

// ─── Admin SSO Management Routes (Require Authentication) ────────────────────

router.use(authenticate);

// Configure SSO for organization
router.post('/configure', validate(configureSsoSchema), ssoController.configureSSO);

// Disable SSO for organization
router.delete('/:orgId', ssoController.disableSSO);

// Get SSO status
router.get('/status/:orgId', ssoController.getSSOStatus);

module.exports = router;
