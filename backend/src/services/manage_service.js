// Custom Pipeline Management Service - Quản lý các chức năng cơ bản cho custom pipelines

import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { db } from '../configs/db.js';

const execAsync = promisify(exec);

/**
 * Stop a custom pipeline (không xóa container, chỉ stop)
 * @param {string} pipelineId - ID của pipeline cần stop
 * @returns {Promise<Object>} Kết quả của việc stop
 */
export async function stopCustomPipeline(pipelineId) {
  const client = await db.connect();
  
  try {
    // Lấy thông tin pipeline từ database
    const pipelineQuery = `
      SELECT id, name, container_id, status, config_path
      FROM custom_pipelines 
      WHERE id = $1 AND deleted = false
    `;
    const result = await client.query(pipelineQuery, [pipelineId]);
    
    if (result.rows.length === 0) {
      throw new Error(`Custom pipeline with ID ${pipelineId} not found`);
    }
    
    const pipeline = result.rows[0];
    
    if (pipeline.status === 'stopped') {
      return {
        success: true,
        message: 'Pipeline is already stopped',
        pipeline: pipeline
      };
    }
    
    console.log(`[Custom Pipeline Manage] Stopping pipeline: ${pipeline.name}`);
    
    // Stop Docker container (không remove)
    const containerName = pipeline.container_id || `custom_pipeline_${pipelineId}`;
    try {
      console.log(`[Custom Pipeline Manage] Stopping container: ${containerName}`);
      execSync(`docker stop ${containerName}`, { stdio: 'pipe' });
    } catch (dockerError) {
      console.warn(`[Custom Pipeline Manage] Docker stop warning: ${dockerError.message}`);
    }
    
    // Update database status
    const updateQuery = `
      UPDATE custom_pipelines 
      SET status = 'stopped', stopped_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const updateResult = await client.query(updateQuery, [pipelineId]);
    const updatedPipeline = updateResult.rows[0];
    
    // Log action
    await logAction(client, pipelineId, 'stop', 'Pipeline stopped successfully');
    
    console.log(`[Custom Pipeline Manage] Pipeline ${pipeline.name} stopped successfully`);
    
    return {
      success: true,
      message: 'Custom pipeline stopped successfully',
      pipeline: updatedPipeline
    };
    
  } catch (error) {
    console.error('[Custom Pipeline Manage] Error stopping pipeline:', error);
    await logAction(client, pipelineId, 'stop', `Error: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Restart a custom pipeline (kiểm tra container và start lại)
 * @param {string} pipelineId - ID của pipeline cần restart
 * @returns {Promise<Object>} Kết quả của việc restart
 */
export async function restartCustomPipeline(pipelineId) {
  const client = await db.connect();
  
  try {
    // Lấy thông tin pipeline
    const pipelineQuery = `
      SELECT id, name, container_id, config_path, exposed_ports, status
      FROM custom_pipelines 
      WHERE id = $1 AND deleted = false
    `;
    const result = await client.query(pipelineQuery, [pipelineId]);
    
    if (result.rows.length === 0) {
      throw new Error(`Custom pipeline with ID ${pipelineId} not found`);
    }
    
    const pipeline = result.rows[0];
    
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

        // Add port mappings for exposed_ports (JSONB - already parsed)
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
      const updateQuery = `
        UPDATE custom_pipelines 
        SET status = 'running', started_at = NOW(), container_id = $2
        WHERE id = $1
        RETURNING *
      `;
      
      const updateResult = await client.query(updateQuery, [pipelineId, containerId]);
      const updatedPipeline = updateResult.rows[0];
      
      // Log action
      await logAction(client, pipelineId, 'restart', 'Pipeline restarted successfully');
      
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
    await logAction(client, pipelineId, 'restart', `Error: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete a custom pipeline (xóa container và data)
 * @param {string} pipelineId - ID của pipeline cần xóa
 * @returns {Promise<Object>} Kết quả của việc xóa
 */
export async function deleteCustomPipeline(pipelineId) {
  const client = await db.connect();
  
  try {
    // Lấy thông tin pipeline
    const pipelineQuery = `
      SELECT id, name, container_id, config_path
      FROM custom_pipelines 
      WHERE id = $1 AND deleted = false
    `;
    const result = await client.query(pipelineQuery, [pipelineId]);
    
    if (result.rows.length === 0) {
      throw new Error(`Custom pipeline with ID ${pipelineId} not found`);
    }
    
    const pipeline = result.rows[0];
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
    const deleteQuery = `
      UPDATE custom_pipelines 
      SET deleted = true, status = 'stopped', stopped_at = NOW(), active = false
      WHERE id = $1
      RETURNING *
    `;
    
    const deleteResult = await client.query(deleteQuery, [pipelineId]);
    const deletedPipeline = deleteResult.rows[0];
    
    // Log action
    await logAction(client, pipelineId, 'delete', 'Pipeline deleted successfully');
    
    console.log(`[Custom Pipeline Manage] Pipeline ${pipeline.name} deleted successfully`);
    
    return {
      success: true,
      message: 'Custom pipeline deleted successfully',
      pipeline: deletedPipeline
    };
    
  } catch (error) {
    console.error('[Custom Pipeline Manage] Error deleting pipeline:', error);
    await logAction(client, pipelineId, 'delete', `Error: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get status của một custom pipeline
 * @param {string} pipelineId - ID của pipeline
 * @returns {Promise<Object>} Thông tin status của pipeline
 */
export async function getCustomPipelineStatus(pipelineId) {
  const client = await db.connect();
  
  try {
    const query = `
      SELECT * FROM custom_pipelines 
      WHERE id = $1 AND deleted = false
    `;
    
    const result = await client.query(query, [pipelineId]);
    
    if (result.rows.length === 0) {
      throw new Error(`Custom pipeline with ID ${pipelineId} not found`);
    }
    
    const pipeline = result.rows[0];
    
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
    
  } finally {
    client.release();
  }
}

/**
 * Get tất cả custom pipelines
 * @returns {Promise<Array>} Danh sách tất cả custom pipelines
 */
export async function getAllCustomPipelines() {
  const client = await db.connect();
  
  try {
    const query = `
      SELECT id, name, description, status, created_at, started_at, stopped_at
      FROM custom_pipelines 
      WHERE deleted = false
      ORDER BY created_at DESC
    `;
    
    const result = await client.query(query);
    return result.rows;
    
  } finally {
    client.release();
  }
}

/**
 * Log action vào custom_pipeline_logs table
 * @param {Object} client - Database client
 * @param {string} pipelineId - ID của pipeline
 * @param {string} action - Action được thực hiện
 * @param {string} message - Message mô tả
 */
async function logAction(client, pipelineId, action, message) {
  try {
    const logQuery = `
      INSERT INTO custom_pipeline_logs (pipeline_id, action, message, created_at)
      VALUES ($1, $2, $3, NOW())
    `;
    await client.query(logQuery, [pipelineId, action, message]);
  } catch (error) {
    console.error('[Custom Pipeline Manage] Error logging action:', error);
    // Không throw error để không ảnh hưởng đến main operation
  }
}
