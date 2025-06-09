// Custom Pipeline Management Controller - Đơn giản

import * as manageService from '../services/manage_service.js';

/**
 * POST /api/manage/stop/:id
 * Stop một custom pipeline
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
    
    const result = await manageService.stopCustomPipeline(id);
    
    res.json({
      status: 'success',
      message: result.message,
      pipeline: result.pipeline
    });
    
  } catch (error) {
    console.error('[Manage Controller] Stop pipeline error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * POST /api/manage/restart/:id
 * Restart một custom pipeline
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
    
    const result = await manageService.restartCustomPipeline(id);
    
    res.json({
      status: 'success',
      message: result.message,
      pipeline: result.pipeline
    });
    
  } catch (error) {
    console.error('[Manage Controller] Restart pipeline error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * DELETE /api/manage/delete/:id
 * Delete một custom pipeline
 */
export async function deletePipeline(req, res) {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'Pipeline ID is required'
      });
    }
    
    const result = await manageService.deleteCustomPipeline(id);
    
    res.json({
      status: 'success',
      message: result.message,
      pipeline: result.pipeline
    });
    
  } catch (error) {
    console.error('[Manage Controller] Delete pipeline error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * GET /api/manage/status/:id
 * Get status của một custom pipeline
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
    
    const pipeline = await manageService.getCustomPipelineStatus(id);
    
    res.json({
      status: 'success',
      pipeline
    });
    
  } catch (error) {
    console.error('[Manage Controller] Get status error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * GET /api/manage/all
 * Get tất cả custom pipelines
 */
export async function getAllPipelines(req, res) {
  try {
    const pipelines = await manageService.getAllCustomPipelines();
    
    res.json({
      status: 'success',
      count: pipelines.length,
      pipelines
    });
    
  } catch (error) {
    console.error('[Manage Controller] Get all pipelines error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}
