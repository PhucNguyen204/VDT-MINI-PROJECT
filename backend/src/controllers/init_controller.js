import * as customPipelineService from '../services/init_service.js';

/**
 * Create a custom pipeline
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function createCustomPipeline(req, res) {
  try {
    const result = await customPipelineService.createCustomPipeline(req.body);
    
    res.status(201).json({
      status: 'created',
      pipeline: result
    });
  } catch (error) {
    console.error('[Custom Pipeline] Create error:', error);
    res.status(400).json({ 
      error: error.message 
    });
  }
}

/**
 * Get all custom pipelines
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function listCustomPipelines(req, res) {
  try {
    const pipelines = await customPipelineService.listCustomPipelines();
    
    res.json({
      status: 'success',
      count: pipelines.length,
      pipelines
    });
  } catch (error) {
    console.error('[Custom Pipeline] List error:', error);
    res.status(500).json({ 
      error: error.message 
    });
  }
}

/**
 * Get custom pipeline details by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getCustomPipeline(req, res) {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ 
        error: 'Pipeline ID is required' 
      });
    }

    const pipeline = await customPipelineService.getCustomPipelineDetails(id);
    
    res.json({
      status: 'success',
      pipeline
    });
  } catch (error) {
    console.error('[Custom Pipeline] Get error:', error);
    
    if (error.message === 'Custom pipeline not found') {
      return res.status(404).json({ 
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      error: error.message 
    });
  }
}

/**
 * Stop and remove a custom pipeline
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function stopCustomPipeline(req, res) {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ 
        error: 'Pipeline ID is required' 
      });
    }

    const result = await customPipelineService.stopCustomPipeline(id);
    
    res.json({
      status: 'stopped',
      pipeline: result
    });
  } catch (error) {
    console.error('[Custom Pipeline] Stop error:', error);
    res.status(500).json({ 
      error: error.message 
    });
  }
}
