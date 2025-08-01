const express = require('express');
const router = express.Router();
const { getStudentCourseFees } = require('../controllers/studentFeesController');

router.get('/student-course-fees/:registrationNumber', getStudentCourseFees);

module.exports = router;
