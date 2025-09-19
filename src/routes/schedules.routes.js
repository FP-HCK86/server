const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/auth');

const SchedulesController = require('../controllers/schedules.controller');

// JWT Authentication middleware
// All routes now use proper JWT authentication instead of mock auth

router.post('/', authenticateToken, SchedulesController.createSchedule);
router.get('/', authenticateToken, SchedulesController.getSchedules);
router.get('/:id', authenticateToken, SchedulesController.getScheduleById);
router.patch('/:id', authenticateToken, SchedulesController.updateSchedule);
router.delete('/:id', authenticateToken, SchedulesController.deleteSchedule);




module.exports = router;
