const Schedule = require('../models/Schedule');
const Persona = require('../models/Persona');

/**
 * Get radar chart data combining posted schedules with user personas' contentStyle
 * @desc    Aggregates data from Schedules (status: 'posted') and Personas (contentStyle)
 * @route   GET /radar-charts/combined
 * @access  Private (requires authentication)
 */
const getCombinedRadarData = async (req, res) => {
  try {
    console.log('=== RADAR CHART: Starting data aggregation ===');
    
    // Step 1: Find all posted schedules (status: 'posted' = Analyzed videos)
    const postedSchedules = await Schedule.find({ 
      status: 'posted',
      user_id: req.user.userId // Only current user's data
    }).select('user_id platform scheduled_at');
    
    console.log(`Found ${postedSchedules.length} posted schedules for user ${req.user.userId}`);
    
    // Step 2: Get unique user IDs from posted schedules
    const userIds = [...new Set(postedSchedules.map(schedule => schedule.user_id.toString()))];
    console.log(`Unique user IDs with posted schedules: ${userIds.length}`);
    
    // Step 3: Find personas for these users
    const personas = await Persona.find({
      userId: { $in: userIds },
      isActive: true // Only active personas
    }).select('userId contentStyle');
    
    console.log(`Found ${personas.length} active personas for these users`);
    
    // Step 4: Create user-to-contentStyle mapping
    const userContentStyleMap = {};
    personas.forEach(persona => {
      userContentStyleMap[persona.userId.toString()] = persona.contentStyle;
    });
    
    // Step 5: Initialize contentStyle counters with all possible values
    const contentStyleCounts = {
      'trendy_viral': 0,
      'educational': 0,
      'behind_scenes': 0,
      'product_showcase': 0,
      'storytelling': 0,
      'tutorial': 0,
      'entertainment': 0,
      'inspirational': 0
    };
    
    // Step 6: Count posted schedules by user's persona contentStyle
    let matchedSchedules = 0;
    let unmatchedSchedules = 0;
    
    postedSchedules.forEach(schedule => {
      const userId = schedule.user_id.toString();
      const contentStyle = userContentStyleMap[userId];
      
      if (contentStyle && contentStyleCounts.hasOwnProperty(contentStyle)) {
        contentStyleCounts[contentStyle]++;
        matchedSchedules++;
      } else {
        unmatchedSchedules++;
        console.log(`No persona found for user ${userId} or invalid contentStyle`);
      }
    });
    
    console.log(`Matched schedules: ${matchedSchedules}, Unmatched: ${unmatchedSchedules}`);
    console.log('ContentStyle distribution:', contentStyleCounts);
    
    // Step 7: Prepare radar chart data format
    const labels = Object.keys(contentStyleCounts).map(style => {
      // Convert enum values to readable labels
      return style.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    });
    
    const values = Object.values(contentStyleCounts);
    const total = values.reduce((sum, val) => sum + val, 0);
    
    const radarData = {
      labels,
      datasets: [{
        label: 'Posted Content by Style',
        data: values,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        borderColor: 'rgba(0, 0, 0, 0.8)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(0, 0, 0, 0.8)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(0, 0, 0, 0.8)'
      }]
    };
    
    // Step 8: Return response
    res.status(200).json({
      success: true,
      message: 'Radar chart data retrieved successfully',
      data: {
        radarChart: radarData,
        summary: {
          totalPostedSchedules: postedSchedules.length,
          matchedWithPersonas: matchedSchedules,
          unmatchedSchedules: unmatchedSchedules,
          totalPersonas: personas.length,
          contentStyleBreakdown: contentStyleCounts
        }
      }
    });
    
  } catch (error) {
    console.error('Error in getCombinedRadarData:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve radar chart data',
      error: error.message
    });
  }
};

/**
 * Get radar chart data for all users (admin/analytics view)
 * @desc    Aggregates data from all users' posted schedules and personas
 * @route   GET /radar-charts/global
 * @access  Private (admin only)
 */
const getGlobalRadarData = async (req, res) => {
  try {
    console.log('=== RADAR CHART: Starting global data aggregation ===');
    
    // Step 1: Find all posted schedules across all users
    const postedSchedules = await Schedule.find({ 
      status: 'posted'
    }).select('user_id platform scheduled_at');
    
    console.log(`Found ${postedSchedules.length} total posted schedules`);
    
    // Step 2: Get unique user IDs
    const userIds = [...new Set(postedSchedules.map(schedule => schedule.user_id.toString()))];
    console.log(`Unique users with posted schedules: ${userIds.length}`);
    
    // Step 3: Find active personas for these users
    const personas = await Persona.find({
      userId: { $in: userIds },
      isActive: true
    }).select('userId contentStyle');
    
    console.log(`Found ${personas.length} active personas`);
    
    // Step 4: Create user-to-contentStyle mapping
    const userContentStyleMap = {};
    personas.forEach(persona => {
      userContentStyleMap[persona.userId.toString()] = persona.contentStyle;
    });
    
    // Step 5: Initialize and count contentStyle distribution
    const contentStyleCounts = {
      'trendy_viral': 0,
      'educational': 0,
      'behind_scenes': 0,
      'product_showcase': 0,
      'storytelling': 0,
      'tutorial': 0,
      'entertainment': 0,
      'inspirational': 0
    };
    
    let matchedSchedules = 0;
    
    postedSchedules.forEach(schedule => {
      const userId = schedule.user_id.toString();
      const contentStyle = userContentStyleMap[userId];
      
      if (contentStyle && contentStyleCounts.hasOwnProperty(contentStyle)) {
        contentStyleCounts[contentStyle]++;
        matchedSchedules++;
      }
    });
    
    // Step 6: Prepare response
    const labels = Object.keys(contentStyleCounts).map(style => 
      style.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    );
    
    const values = Object.values(contentStyleCounts);
    
    const radarData = {
      labels,
      datasets: [{
        label: 'Global Posted Content by Style',
        data: values,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderColor: 'rgba(59, 130, 246, 0.8)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(59, 130, 246, 0.8)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(59, 130, 246, 0.8)'
      }]
    };
    
    res.status(200).json({
      success: true,
      message: 'Global radar chart data retrieved successfully',
      data: {
        radarChart: radarData,
        summary: {
          totalPostedSchedules: postedSchedules.length,
          totalUsers: userIds.length,
          matchedWithPersonas: matchedSchedules,
          totalPersonas: personas.length,
          contentStyleBreakdown: contentStyleCounts
        }
      }
    });
    
  } catch (error) {
    console.error('Error in getGlobalRadarData:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve global radar chart data',
      error: error.message
    });
  }
};

module.exports = {
  getCombinedRadarData,
  getGlobalRadarData
};
