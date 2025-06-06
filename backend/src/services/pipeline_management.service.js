// pipeline_management.service.js
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { db } from '../configs/db.js';

const execAsync = promisify(exec);

/**
 * Stop a pipeline by stopping its Docker container and updating database
 * @param {string} pipelineId - UUID of the pipeline to stop
 * @returns {Promise<Object>} Result of the stop operation
 */
export async function stopPipeline(pipelineId) {
  const client = await db.connect();
  
  try {    // Get pipeline info from database
    const pipelineQuery = `
      SELECT id, name, container_id, config_path, active 
      FROM pipelines 
      WHERE id = $1 AND deleted = false
    `;
    const pipelineResult = await client.query(pipelineQuery, [pipelineId]);
    
    if (pipelineResult.rows.length === 0) {
      throw new Error(`Pipeline with ID ${pipelineId} not found`);
    }
    
    const pipeline = pipelineResult.rows[0];
    
    if (!pipeline.active) {
      return {
        success: true,
        message: 'Pipeline is already stopped',
        pipeline: pipeline
      };
    }
    
    console.log(`[Pipeline Management] Stopping pipeline: ${pipeline.name}`);
    
    // Stop Docker container
    const containerName = `vector_${pipelineId}`;
    try {
      console.log(`[Pipeline Management] Stopping container: ${containerName}`);
      execSync(`docker stop ${containerName}`, { stdio: 'pipe' });
      
      // console.log(`[Pipeline Management] Removing container: ${containerName}`);
      // execSync(`docker rm ${containerName}`, { stdio: 'pipe' });
      
    } catch (dockerError) {
      console.warn(`[Pipeline Management] Docker operation warning: ${dockerError.message}`);
    }
    
    // Update database - trigger will handle stopped_at timestamp
    const updateQuery = `
      UPDATE pipelines 
      SET active = false
      WHERE id = $1
      RETURNING *
    `;
    
    const updateResult = await client.query(updateQuery, [pipelineId]);
    const updatedPipeline = updateResult.rows[0];
    
    // Remove config file if exists
    // if (pipeline.config_path && fs.existsSync(pipeline.config_path)) {
    //   try {
    //     fs.unlinkSync(pipeline.config_path);
    //     console.log(`[Pipeline Management] Removed config file: ${pipeline.config_path}`);
    //   } catch (fileError) {
    //     console.warn(`[Pipeline Management] Could not remove config file: ${fileError.message}`);
    //   }
    // }
    
    console.log(`[Pipeline Management] Pipeline ${pipeline.name} stopped successfully`);
    
    return {
      success: true,
      message: 'Pipeline stopped successfully',
      pipeline: updatedPipeline
    };
    
  } catch (error) {
    console.error('[Pipeline Management] Error stopping pipeline:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get all running pipelines
 * @returns {Promise<Array>} List of active pipelines
 */
export async function getActivePipelines() {
  const client = await db.connect();
  
  try {    const query = `
      SELECT id, name, source_type, sink_type, container_id, created_at
      FROM pipelines 
      WHERE active = true AND deleted = false
      ORDER BY created_at DESC
    `;
    
    const result = await client.query(query);
    return result.rows;
    
  } finally {
    client.release();
  }
}

/**
 * Get pipeline status and info
 * @param {string} pipelineId - UUID of the pipeline
 * @returns {Promise<Object>} Pipeline information
 */
export async function getPipelineStatus(pipelineId) {
  const client = await db.connect();
  
  try {    const query = `
      SELECT * FROM pipelines WHERE id = $1 AND deleted = false
    `;
    
    const result = await client.query(query, [pipelineId]);
    
    if (result.rows.length === 0) {
      throw new Error(`Pipeline with ID ${pipelineId} not found`);
    }
    
    const pipeline = result.rows[0];
    
    // Check if Docker container is actually running
    let containerRunning = false;
    try {
      const containerName = `vector_${pipelineId}`;
      execSync(`docker inspect ${containerName}`, { stdio: 'pipe' });
      containerRunning = true;
    } catch {
      containerRunning = false;
    }
    
    return {
      ...pipeline,
      container_running: containerRunning
    };
    
  } finally {
    client.release();
  }
}

/**
 * Stop all active pipelines
 * @returns {Promise<Object>} Result of stopping all pipelines
 */
export const stopAllPipelines = async () => {
    const client = await db.connect();
    
    try {        // Get all active pipelines
        const activePipelinesResult = await client.query(
            'SELECT id, name FROM pipelines WHERE active = true AND deleted = false'
        );
        
        const activePipelines = activePipelinesResult.rows;
        
        if (activePipelines.length === 0) {
            return {
                success: true,
                message: 'No active pipelines to stop',
                stoppedCount: 0,
                failedCount: 0,
                results: []
            };
        }

        const results = [];
        let stoppedCount = 0;
        let failedCount = 0;        // Stop each pipeline
        for (const pipeline of activePipelines) {
            try {
                const containerName = `vector_${pipeline.id}`;
                
                // Stop and remove Docker container
                try {
                    await execAsync(`docker stop ${containerName}`);
                    // await execAsync(`docker rm ${containerName}`);
                } catch (dockerError) {
                    console.warn(`Docker operation warning for ${containerName}: ${dockerError.message}`);
                    // Continue even if container is already stopped/removed
                }
                
                // Update database (trigger will automatically set stopped_at)
                await client.query(
                    'UPDATE pipelines SET active = false WHERE id = $1',
                    [pipeline.id]
                );
                
                results.push({
                    id: pipeline.id,
                    name: pipeline.name,
                    status: 'stopped',
                    success: true
                });
                
                stoppedCount++;
            } catch (error) {
                console.error(`Failed to stop pipeline ${pipeline.id}:`, error);
                results.push({
                    id: pipeline.id,
                    name: pipeline.name,
                    status: 'failed',
                    success: false,
                    error: error.message
                });
                
                failedCount++;
            }
        }

        return {
            success: stoppedCount > 0,
            message: `Stopped ${stoppedCount} pipelines, ${failedCount} failed`,
            stoppedCount,
            failedCount,
            totalCount: activePipelines.length,
            results
        };

    } catch (error) {
        console.error('Error stopping all pipelines:', error);
        throw new Error(`Failed to stop all pipelines: ${error.message}`);
    } finally {
        client.release();
    }
}

/**
 * Restart a stopped pipeline by creating a new container with existing config
 * @param {string} pipelineId - UUID of the pipeline to restart
 * @returns {Promise<Object>} Result of the restart operation
 */
export async function restartPipeline(pipelineId) {
  const client = await db.connect();
  
  try {
    // Get pipeline info from database
    const pipelineQuery = `
      SELECT id, name, source_type, sink_type, config_path, active, deleted 
      FROM pipelines 
      WHERE id = $1
    `;
    const pipelineResult = await client.query(pipelineQuery, [pipelineId]);
    
    if (pipelineResult.rows.length === 0) {
      throw new Error(`Pipeline with ID ${pipelineId} not found`);
    }
    
    const pipeline = pipelineResult.rows[0];
    
    // Check if pipeline can be restarted
    if (pipeline.deleted) {
      throw new Error('Cannot restart deleted pipeline');
    }
    
    if (pipeline.active) {
      return {
        success: true,
        message: 'Pipeline is already running',
        pipeline: pipeline
      };
    }
    
    console.log(`[Pipeline Management] Restarting pipeline: ${pipeline.name}`);
    
    // Check if config file exists
    if (!pipeline.config_path || !fs.existsSync(pipeline.config_path)) {
      throw new Error('Pipeline config file not found. Cannot restart.');
    }
      // Restart container logic
    const containerName = `vector_${pipelineId}`;
    const configPath = pipeline.config_path;
    
    console.log(`[Pipeline Management] Restarting container: ${containerName}`);
    console.log(`[Pipeline Management] Using config: ${configPath}`);
    
    try {
      // Check if container exists
      let containerExists = false;
      let existingContainerId = null;
      
      try {
        const { stdout } = await execAsync(`docker inspect ${containerName} --format="{{.Id}}"`);
        existingContainerId = stdout.trim();
        containerExists = true;
        console.log(`[Pipeline Management] Container exists: ${existingContainerId}`);
      } catch (inspectError) {
        console.log(`[Pipeline Management] Container does not exist, will create new one`);
        containerExists = false;
      }
      
      let containerId;
      
      if (containerExists) {
        // Container exists, just start it
        console.log(`[Pipeline Management] Starting existing container: ${containerName}`);
        await execAsync(`docker start ${containerName}`);
        containerId = existingContainerId;
        console.log(`[Pipeline Management] Container started: ${containerId}`);      } else {
        // Container doesn't exist, create new one
        console.log(`[Pipeline Management] Creating new container: ${containerName}`);
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

        // Add port mapping based on pipeline source type
        if (pipeline.source_type === 'push_http') {
          // Check config file to determine the port
          try {
            const configContent = fs.readFileSync(configPath, 'utf8');
            const portMatch = configContent.match(/address:\s*0\.0\.0\.0:(\d+)/);
            if (portMatch) {
              const port = portMatch[1];
              dockerArgs.push('-p', `${port}:${port}`);
              console.log(`[Pipeline Management] Exposing HTTP port: ${port}`);
            }
          } catch (err) {
            console.warn(`[Pipeline Management] Could not read config for port mapping: ${err.message}`);
          }
        } else if (pipeline.source_type === 'push_syslog') {
          dockerArgs.push('-p', '5514:5514');
          console.log('[Pipeline Management] Exposing Syslog port: 5514');
        }

        dockerArgs.push(
          'timberio/vector:0.47.0-debian',
          '-c', configPath, '--watch-config'
        );

        const { stdout, stderr } = await execAsync(`docker ${dockerArgs.join(' ')}`);
        containerId = stdout.trim();
        
        if (!containerId) {
          throw new Error(`Failed to create container: ${stderr}`);
        }
        
        console.log(`[Pipeline Management] New container created: ${containerId}`);
      }
      
      // Update database - set active=true, clear stopped_at, update container_id
      const updateQuery = `
        UPDATE pipelines 
        SET active = true, stopped_at = null, container_id = $2
        WHERE id = $1
        RETURNING *
      `;
      
      const updateResult = await client.query(updateQuery, [pipelineId, containerId]);
      const updatedPipeline = updateResult.rows[0];
      
      console.log(`[Pipeline Management] Pipeline ${pipeline.name} restarted successfully`);
      
      return {
        success: true,
        message: 'Pipeline restarted successfully',
        pipeline: updatedPipeline,
        containerId: containerId
      };
      
    } catch (dockerError) {
      console.error(`[Pipeline Management] Docker restart error: ${dockerError.message}`);
      throw new Error(`Failed to restart container: ${dockerError.message}`);
    }
    
  } catch (error) {
    console.error('[Pipeline Management] Error restarting pipeline:', error);
    throw error;
  } finally {
    client.release();
  }
}
