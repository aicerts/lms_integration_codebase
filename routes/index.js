const express = require('express');
const router = express.Router();
// Import the 'Certificate' router module
let Certificate = require('./certificate');

/**
 * Express middleware for routes under the "/api" path.
 *
 * All routes defined in the 'Certificate' router will be prefixed with "/api".
 */
router.use("/api", Certificate);

// Export the router for use in the main application
module.exports = router;
