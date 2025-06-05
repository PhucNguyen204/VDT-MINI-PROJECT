import * as multiPipelineService from '../services/mutiple_pipeline_service.js';

/**
 * POST /api/multi-pipelines
 * Create a new pipeline with unique container
 * Body: { name, mode, ...config }
 */
export async function createMultiPipeline(req, res) {
  try {
    const { name, mode } = req.body;
    
    // Validate required fields
    if (!name || !mode) {
      return res.status(400).json({ 
        error: 'Missing required fields: name and mode' 
      });
    }

    // For docker_logs mode, if name is provided, include that container
    if (mode === 'docker_logs' && name) {
      req.body.include_containers = [name];
    }

    const result = await multiPipelineService.createPipeline(req.body);
    
    res.status(201).json({
      status: 'created',
      pipeline: result
    });
  } catch (error) {
    console.error('[MultiPipeline] Create error:', error);
    res.status(500).json({ 
      error: error.message 
    });
  }
}

/**
 * GET /api/multi-pipelines
 * List all pipelines
 */
export async function listMultiPipelines(req, res) {
  try {
    const pipelines = await multiPipelineService.listPipelines();
    
    res.json({
      status: 'success',
      count: pipelines.length,
      pipelines
    });
  } catch (error) {
    console.error('[MultiPipeline] List error:', error);
    res.status(500).json({ 
      error: error.message 
    });
  }
}

/**
 * DELETE /api/multi-pipelines/:id
 * Stop and remove a pipeline
 */
export async function stopMultiPipeline(req, res) {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ 
        error: 'Pipeline ID is required' 
      });
    }

    const result = await multiPipelineService.stopPipeline(id);
    
    res.json({
      status: 'stopped',
      pipeline: result
    });
  } catch (error) {
    console.error('[MultiPipeline] Stop error:', error);
    res.status(500).json({ 
      error: error.message 
    });
  }
}

/**
 * GET /api/multi-pipelines/:id
 * Get pipeline details by ID
 */
export async function getMultiPipeline(req, res) {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ 
        error: 'Pipeline ID is required' 
      });
    }

    // Get pipeline from database
    const pipelines = await multiPipelineService.listPipelines();
    const pipeline = pipelines.find(p => p.id === id);
    
    if (!pipeline) {
      return res.status(404).json({ 
        error: 'Pipeline not found' 
      });
    }

    res.json({
      status: 'success',
      pipeline
    });
  } catch (error) {
    console.error('[MultiPipeline] Get error:', error);
    res.status(500).json({ 
      error: error.message 
    });
  }
}
