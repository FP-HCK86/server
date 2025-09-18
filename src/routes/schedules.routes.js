const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');

const { createSchedule, getSchedules, getScheduleById} = require('../controllers/schedules.controller');


const mockAuth = (req, res, next)=>{
    req.user = {id :'66f000000000000000000001'}

    next()
}

router.post('/', mockAuth, createSchedule);
router.get('/', mockAuth, getSchedules);
router.get('/:id', mockAuth, getScheduleById); // Commented out to resolve error; ensure getScheduleById is a function in controller



module.exports = router;
