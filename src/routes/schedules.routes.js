const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');

const SchedulesController = require('../controllers/schedules.controller');


const mockAuth = (req, res, next)=>{
    req.user = {id :'66f000000000000000000001'}

    next()
}

router.post('/', mockAuth, SchedulesController.createSchedule);
router.get('/', mockAuth, SchedulesController.getSchedules);
router.get('/:id', mockAuth, SchedulesController.getScheduleById);
router.patch('/:id', mockAuth, SchedulesController.updateSchedule)
router.delete('/:id', mockAuth, SchedulesController.deleteSchedule)




module.exports = router;
