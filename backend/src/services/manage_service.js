// Custom Pipeline Management Service - Quản lý các chức năng cơ bản cho custom pipelines

import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { pipelineRepository, logsRepository } from '../repositories/index.js';
import { serviceLogger, dockerLogger, pipelineLogger } from '../configs/logger.js';

const execAsync = promisify(exec);

/**
 * Stop a custom pipeline (không xóa container, chỉ stop)
 * @param {string} pipelineId - ID của pipeline cần stop
 * @returns {Promise<Object>} Kết quả của việc stop
 */
export async function stopCustomPipeline(pipelineId) {
  const startTime = Date.now();
  serviceLogger.info('Starting pipeline stop operation', { pipelineId });
  
  try {
    // Lấy thông tin pipeline từ database
    const pipeline = await pipelineRepository.findById(pipelineId);
    
    if (!pipeline) {
      serviceLogger.warn('Pipeline not found for stop operation', { pipelineId });
      throw new Error(`Custom pipeline with ID ${pipelineId} not found`);
    }
    
    if (pipeline.status === 'stopped') {
      serviceLogger.info('Pipeline already stopped', { 
        pipelineId, 
        pipelineName: pipeline.name 
      });
      return {
        success: true,
        message: 'Pipeline is already stopped',
        pipeline: pipeline
      };
    }
    
    pipelineLogger.info('Stopping pipeline', { 
      pipelineId, 
      pipelineName: pipeline.name,
      currentStatus: pipeline.status
    });
    
    // Stop Docker container (không remove)
    const containerName = pipeline.container_id || `custom_pipeline_${pipelineId}`;
    try {
      dockerLogger.info('Stopping Docker container', { 
        containerName, 
        pipelineId 
      });
      execSync(`docker stop ${containerName}`, { stdio: 'pipe' });
      dockerLogger.info('Docker container stopped successfully', { 
        containerName, 
        pipelineId 
      });
    } catch (dockerError) {
      dockerLogger.warn('Docker stop warning', { 
        containerName, 
        pipelineId,
        error: dockerError.message
      });
    }
    
    // Update database status
    const updatedPipeline = await pipelineRepository.update(pipelineId, {
      status: 'stopped',
      stopped_at: new Date()
    });
    
    // Log action
    await logsRepository.create({
      pipeline_id: pipelineId,
      log_level: 'INFO',
      action: 'stop',
      message: 'Pipeline stopped successfully'
    });
    
    const duration = Date.now() - startTime;
    pipelineLogger.info('Pipeline stopped successfully', { 
      pipelineId, 
      pipelineName: pipeline.name,
      duration: `${duration}ms`
    });
    
    return {
      success: true,
      message: 'Custom pipeline stopped successfully',
      pipeline: updatedPipeline
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    serviceLogger.error('Pipeline stop operation failed', {
      pipelineId,
      error: error.message,
      duration: `${duration}ms`
    });
    
    await logsRepository.create({
      pipeline_id: pipelineId,
      log_level: 'ERROR',
      action: 'stop',
      message: `Error: ${error.message}`
    });
    throw error;
  }
}

/**
 * Restart a custom pipeline (kiểm tra container và start lại)
 * @param {string} pipelineId - ID của pipeline cần restart
 * @returns {Promise<Object>} Kết quả của việc restart
 */
export async function restartCustomPipeline(pipelineId) {
  try {
    // Lấy thông tin pipeline
    const pipeline = await pipelineRepository.findById(pipelineId);
    
    if (!pipeline) {
      throw new Error(`Custom pipeline with ID ${pipelineId} not found`);
    }
    
    // Check if pipeline is already running
    if (pipeline.status === 'running') {
      return {
        success: true,
        message: 'Pipeline is already running',
        pipeline: pipeline
      };
    }
    
    console.log(`[Custom Pipeline Manage] Restarting pipeline: ${pipeline.name}`);
    
    // Check if config file exists
    if (!pipeline.config_path || !fs.existsSync(pipeline.config_path)) {
      throw new Error('Pipeline config file not found. Cannot restart.');
    }
    
    // Container restart logic
    const containerName = pipeline.container_id || `custom_pipeline_${pipelineId}`;
    const configPath = pipeline.config_path;
    
    console.log(`[Custom Pipeline Manage] Restarting container: ${containerName}`);
    console.log(`[Custom Pipeline Manage] Using config: ${configPath}`);
    
    try {
      // Check if container exists
      let containerExists = false;
      let existingContainerId = null;
      
      try {
        const { stdout } = await execAsync(`docker inspect ${containerName} --format="{{.Id}}"`);
        existingContainerId = stdout.trim();
        containerExists = true;
        console.log(`[Custom Pipeline Manage] Container exists: ${existingContainerId}`);
      } catch (inspectError) {
        console.log(`[Custom Pipeline Manage] Container does not exist, will create new one`);
        containerExists = false;
      }
      
      let containerId;
      
      if (containerExists) {
        // Container exists, just start it
        console.log(`[Custom Pipeline Manage] Starting existing container: ${containerName}`);
        await execAsync(`docker start ${containerName}`);
        containerId = existingContainerId;
        console.log(`[Custom Pipeline Manage] Container started: ${containerId}`);
      } else {
        // Container doesn't exist, create new one
        console.log(`[Custom Pipeline Manage] Creating new container: ${containerName}`);
        
        const dockerArgs = [
          'run', '-d',
          '--name', containerName,
          '--network', 'demo_vdt_vector-network',
          '-e', `AWS_ACCESS_KEY_ID=${process.env.AWS_ACCESS_KEY_ID}`,
          '-e', `AWS_SECRET_ACCESS_KEY=${process.env.AWS_SECRET_ACCESS_KEY}`,
          '-e', `AWS_DEFAULT_REGION=${process.env.AWS_DEFAULT_REGION}`,
          '--volumes-from', 'demo_vdt_api',
          '-v', '/var/run/docker.sock:/var/run/docker.sock:ro'
        ];

        // Add port mappings for exposed_ports (already parsed from JSON)
        const exposedPorts = pipeline.exposed_ports || [];
        if (Array.isArray(exposedPorts) && exposedPorts.length > 0) {
          exposedPorts.forEach(portConfig => {
            if (portConfig && portConfig.port) {
              dockerArgs.push('-p', `${portConfig.port}:${portConfig.port}`);
              console.log(`[Custom Pipeline Manage] Exposing port: ${portConfig.port} (${portConfig.type})`);
            }
          });
        }

        dockerArgs.push(
          '-v', `${configPath}:/etc/vector/vector.yaml:ro`,
          'timberio/vector:0.47.0-debian',
          '-c', '/etc/vector/vector.yaml', '--watch-config'
        );

        const { stdout, stderr } = await execAsync(`docker ${dockerArgs.join(' ')}`);
        containerId = stdout.trim();
        
        if (!containerId) {
          throw new Error(`Failed to create container: ${stderr}`);
        }
        
        console.log(`[Custom Pipeline Manage] New container created: ${containerId}`);
      }
      
      // Update database status
      const updatedPipeline = await pipelineRepository.update(pipelineId, {
        status: 'running',
        started_at: new Date(),
        container_id: containerId
      });
      
      // Log action
      await logsRepository.create({
        pipeline_id: pipelineId,
        log_level: 'INFO',
        action: 'restart',
        message: 'Pipeline restarted successfully'
      });
      
      console.log(`[Custom Pipeline Manage] Pipeline ${pipeline.name} restarted successfully`);
      
      return {
        success: true,
        message: 'Custom pipeline restarted successfully',
        pipeline: updatedPipeline,
        containerId: containerId
      };
      
    } catch (dockerError) {
      console.error(`[Custom Pipeline Manage] Docker restart error: ${dockerError.message}`);
      throw new Error(`Failed to restart container: ${dockerError.message}`);
    }
    
  } catch (error) {
    console.error('[Custom Pipeline Manage] Error restarting pipeline:', error);
    await logsRepository.create({
      pipeline_id: pipelineId,
      log_level: 'ERROR',
      action: 'restart',
      message: `Error: ${error.message}`
    });
    throw error;
  }
}

/**
 * Delete a custom pipeline (xóa container và data)
 * @param {string} pipelineId - ID của pipeline cần xóa
 * @returns {Promise<Object>} Kết quả của việc xóa
 */
export async function deleteCustomPipeline(pipelineId) {
  try {
    // Lấy thông tin pipeline
    const pipeline = await pipelineRepository.findById(pipelineId);
    
    if (!pipeline) {
      throw new Error(`Custom pipeline with ID ${pipelineId} not found`);
    }
    
    const containerName = pipeline.container_id || `custom_pipeline_${pipelineId}`;
    
    console.log(`[Custom Pipeline Manage] Deleting pipeline: ${pipeline.name}`);
    
    // Stop và remove Docker container
    try {
      execSync(`docker stop ${containerName}`, { stdio: 'pipe' });
      console.log(`[Custom Pipeline Manage] Stopped container: ${containerName}`);
    } catch (stopError) {
      console.warn(`[Custom Pipeline Manage] Container may already be stopped: ${stopError.message}`);
    }
    
    try {
      execSync(`docker rm ${containerName}`, { stdio: 'pipe' });
      console.log(`[Custom Pipeline Manage] Removed container: ${containerName}`);
    } catch (removeError) {
      console.warn(`[Custom Pipeline Manage] Container may already be removed: ${removeError.message}`);
    }
    
    // Remove config file nếu tồn tại
    if (pipeline.config_path && fs.existsSync(pipeline.config_path)) {
      try {
        fs.unlinkSync(pipeline.config_path);
        console.log(`[Custom Pipeline Manage] Removed config file: ${pipeline.config_path}`);
      } catch (fileError) {
        console.warn(`[Custom Pipeline Manage] Could not remove config file: ${fileError.message}`);
      }
    }
    
    // Update database - soft delete
    const deletedPipeline = await pipelineRepository.update(pipelineId, {
      deleted: true,
      status: 'stopped',
      stopped_at: new Date(),
      active: false
    });
    
    // Log action
    await logsRepository.create({
      pipeline_id: pipelineId,
      log_level: 'INFO',
      action: 'delete',
      message: 'Pipeline deleted successfully'
    });
    
    console.log(`[Custom Pipeline Manage] Pipeline ${pipeline.name} deleted successfully`);
    
    return {
      success: true,
      message: 'Custom pipeline deleted successfully',
      pipeline: deletedPipeline
    };
    
  } catch (error) {
    console.error('[Custom Pipeline Manage] Error deleting pipeline:', error);
    await logsRepository.create({
      pipeline_id: pipelineId,
      log_level: 'ERROR',
      action: 'delete',
      message: `Error: ${error.message}`
    });
    throw error;
  }
}

/**
 * Get status của một custom pipeline
 * @param {string} pipelineId - ID của pipeline
 * @returns {Promise<Object>} Thông tin status của pipeline
 */
export async function getCustomPipelineStatus(pipelineId) {
  try {
    const pipeline = await pipelineRepository.findById(pipelineId);
    
    if (!pipeline) {
      throw new Error(`Custom pipeline with ID ${pipelineId} not found`);
    }
    
    // Check container status
    let containerRunning = false;
    const containerName = pipeline.container_id || `custom_pipeline_${pipelineId}`;
    
    try {
      const output = execSync(`docker inspect ${containerName} --format="{{.State.Running}}"`, { 
        stdio: 'pipe', 
        encoding: 'utf8' 
      }).trim();
      containerRunning = output === 'true';
    } catch {
      containerRunning = false;
    }
    
    return {
      ...pipeline,
      container_running: containerRunning,
      container_status: containerRunning ? 'running' : 'stopped'
    };
    
  } catch (error) {
    console.error('[Custom Pipeline Manage] Error getting pipeline status:', error);
    throw error;
  }
}

/**
 * Get tất cả custom pipelines
 * @returns {Promise<Array>} Danh sách tất cả custom pipelines
 */
export async function getAllCustomPipelines() {
  try {
    const pipelines = await pipelineRepository.findAll({}, {
      orderBy: 'created_at'
    });
    
    // Filter only required fields to match original API
    return pipelines.map(pipeline => ({
      id: pipeline.id,
      name: pipeline.name,
      description: pipeline.description,
      status: pipeline.status,
      created_at: pipeline.created_at,
      started_at: pipeline.started_at,
      stopped_at: pipeline.stopped_at
    }));
    
  } catch (error) {
    console.error('[Custom Pipeline Manage] Error getting all pipelines:', error);
    throw error;
  }
}


