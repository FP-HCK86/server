const express = require('express');
const router = express.Router();
const auth = require ('../middlewares/auth')
const SchedulesController = require('../controllers/schedules.controller');




router.post('/', auth, SchedulesController.createSchedule);
router.get('/', auth, SchedulesController.getSchedules);
router.get('/:id', auth, SchedulesController.getScheduleById);
router.patch('/:id', auth, SchedulesController.updateSchedule)
router.delete('/:id', auth, SchedulesController.deleteSchedule)
router.post('/:id/run-now', auth, SchedulesController.runNow)




module.exports = router;
