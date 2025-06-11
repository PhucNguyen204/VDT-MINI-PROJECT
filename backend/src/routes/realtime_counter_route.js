// Real-time Counter Routes
// Routes for real-time log counting APIs

import express from 'express';
import {
  startRealTimeCounter,
  stopRealTimeCounter,
  getPipelineLogCounts,
  getAllPipelineLogCounts,
  forceUpdatePipelineCounters,
  resetPipelineCounters,
  getRealTimeCounterStatus,
  getPipelineLogCountSummary
} from '../controllers/realtime_counter_controller.js';

const router = express.Router();

// Control endpoints
router.post('/start', startRealTimeCounter);
router.post('/stop', stopRealTimeCounter);
router.get('/status', getRealTimeCounterStatus);

// Data endpoints
router.get('/counts', getAllPipelineLogCounts);
router.get('/counts/:pipelineId', getPipelineLogCounts);
router.get('/summary/:pipelineId', getPipelineLogCountSummary);

// Action endpoints
router.post('/update/:pipelineId', forceUpdatePipelineCounters);
router.post('/reset/:pipelineId', resetPipelineCounters);

export default router;
