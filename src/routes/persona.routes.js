const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authentication');
const {
  getUserPersonas,
  getActivePersona,
  createPersona,
  updatePersona,
  activatePersona,
  deletePersona,
  getPersonaWizard,
  deactivateAllPersonas
} = require('../controllers/persona.controller');

// Middleware for request logging (optional)
const requestLogger = (req, res, next) => {
  console.log(`[Persona API] ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
};

// Apply logging middleware
router.use(requestLogger);

// Apply authentication middleware
router.use(authMiddleware);

/**
 * Persona Management Routes
 */

// Get persona creation wizard questions
router.get('/wizard', getPersonaWizard);

// Get all personas for user
router.get('/', getUserPersonas);

// Get active persona for user
router.get('/active', getActivePersona);

// Create new persona
router.post('/', createPersona);

// Deactivate all personas for user (must be before /:id routes)
router.put('/deactivate-all', deactivateAllPersonas);

// Update existing persona
router.put('/:id', updatePersona);

// Activate a persona (set as active)
router.put('/:id/activate', activatePersona);

// Delete persona
router.delete('/:id', deletePersona);

module.exports = router;
