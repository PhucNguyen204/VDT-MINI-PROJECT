// pipeline_management.controller.js
import * as pipelineManagementService from '../services/pipeline_management.service.js';

/**
 * POST /api/pipeline-management/stop/:id
 * Stop a specific pipeline
 */
export async function stopPipeline(req, res) {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'Pipeline ID is required'
      });
    }
    
    const result = await pipelineManagementService.stopPipeline(id);
    
    res.json({
      status: 'success',
      ...result
    });
    
  } catch (error) {
    console.error('[Pipeline Management Controller] Stop pipeline error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * POST /api/pipeline-management/stop-all
 * Stop all active pipelines
 */
export async function stopAllPipelines(req, res) {
  try {
    const result = await pipelineManagementService.stopAllPipelines();
    
    res.status(200).json({
      status: 'success',
      message: result.message,
      data: {
        stoppedCount: result.stoppedCount,
        failedCount: result.failedCount,
        totalCount: result.totalCount,
        results: result.results
      }
    });
  } catch (error) {
    console.error('Error in stopAllPipelines controller:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to stop all pipelines',
      error: error.message
    });
  }
}

/**
 * GET /api/pipeline-management/active
 * Get all active pipelines
 */
export async function getActivePipelines(req, res) {
  try {
    res.json({
      status: 'success',
      message: 'This is a test response',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Pipeline Management Controller] Get active pipelines error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * GET /api/pipeline-management/status/:id
 * Get pipeline status and info
 */
export async function getPipelineStatus(req, res) {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'Pipeline ID is required'
      });
    }
    
    const pipeline = await pipelineManagementService.getPipelineStatus(id);
    
    res.json({
      status: 'success',
      pipeline
    });
    
  } catch (error) {
    console.error('[Pipeline Management Controller] Get pipeline status error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * GET /api/pipeline-management/test
 * Test endpoint to verify pipeline management is working
 */
export async function testPipelineManagement(req, res) {
  try {
    res.json({
      status: 'success',
      message: 'Pipeline Management API is working',
      timestamp: new Date().toISOString(),
      endpoints: {
        test: 'GET /api/pipeline-management/test',
        stop: 'POST /api/pipeline-management/stop/:id',
        stopAll: 'POST /api/pipeline-management/stop-all',
        active: 'GET /api/pipeline-management/active',
        status: 'GET /api/pipeline-management/status/:id'
      }
    });
  } catch (error) {
    console.error('[Pipeline Management Controller] Test error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * POST /api/pipeline-management/restart/:id
 * Restart a stopped pipeline
 */
export async function restartPipeline(req, res) {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'Pipeline ID is required'
      });
    }
    
    const result = await pipelineManagementService.restartPipeline(id);
    
    res.json({
      status: 'success',
      ...result
    });
    
  } catch (error) {
    console.error('[Pipeline Management Controller] Restart pipeline error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}
