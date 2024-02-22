const express = require('express');
const router = express.Router();
const certificateController = require('../controllers/certificate');

/**
 * Express route for issuing an encrypted certificate.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
router.post('/issue', (req, res) => certificateController.issueCertificate(req, res));

/**
 * Express route for verifying an encrypted certificate.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
router.post('/verify-decrypt', (req, res) => certificateController.decodeCertificate(req, res));

// Export the router for use in the main application
module.exports = router;

