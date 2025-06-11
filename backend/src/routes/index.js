import { Router } from 'express';
import customMonitorRouter from './monitor_route.js';
import customPipelinesRouter from './init_route.js';
import manageRouter from './manage_route.js';
import schedulerRouter from './scheduler_route.js';
import realTimeCounterRouter from './realtime_counter_route.js';

const router = Router();

// Custom pipeline endpoints
router.use('/custom-pipelines', customPipelinesRouter);

// Custom pipeline management endpoints (đơn giản)
router.use('/manage', manageRouter);

// Custom monitoring endpoints
router.use('/custom-monitoring', customMonitorRouter);

// Automated metrics collection scheduler
router.use('/scheduler', schedulerRouter);

// Real-time log counter
router.use('/realtime-counter', realTimeCounterRouter);

export default router;