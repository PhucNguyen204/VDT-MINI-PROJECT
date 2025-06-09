// Custom Pipeline Management Routes - Đơn giản

import express from 'express';
import * as manageController from '../controllers/manage_controller.js';

const router = express.Router();

// Stop pipeline
router.post('/stop/:id', manageController.stopPipeline);

// Restart pipeline
router.post('/restart/:id', manageController.restartPipeline);

// Delete pipeline
router.delete('/delete/:id', manageController.deletePipeline);

// Get pipeline status
router.get('/status/:id', manageController.getPipelineStatus);

// Get all pipelines
router.get('/all', manageController.getAllPipelines);

export default router;
