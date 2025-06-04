import { Router } from 'express';
import { createPipeline } from '../controllers/pipeline.controller.js';

const router = Router();
router.post('/pipeline', createPipeline);

export default router;