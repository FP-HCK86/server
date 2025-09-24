const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/auth');

const RadarChartController = require('../controllers/radarChart.controller');

/**
 * Radar Chart Routes
 * @desc Routes for radar chart data combining posted schedules with personas
 * @base /radar-charts
 */

// JWT Authentication middleware for all radar chart routes
// All routes require proper authentication to access user-specific data

/**
 * @route   GET /radar-charts/combined
 * @desc    Get radar chart data for current authenticated user
 * @access  Private (requires authentication)
 * @returns Radar chart data combining user's posted schedules with their persona's contentStyle
 */
router.get('/combined', authenticateToken, RadarChartController.getCombinedRadarData);

/**
 * @route   GET /radar-charts/global
 * @desc    Get global radar chart data across all users (admin/analytics view)
 * @access  Private (requires authentication - future: admin only)
 * @returns Global radar chart data for platform-wide analytics
 */
router.get('/global', authenticateToken, RadarChartController.getGlobalRadarData);

module.exports = router;
