/* Custom Pipeline Service - Cho phép người dùng tự cấu hình sources, transforms, sinks */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { spawnSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { db } from '../configs/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rel = p => path.join(__dirname, p);
const RUNTIME_DIR = '/runtime/configs';

/*═══════════════════════════════════════════════════════*/
/* Database Operations                                   */
/*═══════════════════════════════════════════════════════*/

async function savePipelineToDatabase(pipelineData) {
  const query = `
    INSERT INTO custom_pipelines (
      id, name, description, sources_config, transforms_config, sinks_config,
      container_id, config_path, exposed_ports, status, started_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
  `;
  
  const values = [
    pipelineData.id,
    pipelineData.name,
    pipelineData.description || null,
    JSON.stringify(pipelineData.sources_config),
    JSON.stringify(pipelineData.transforms_config),
    JSON.stringify(pipelineData.sinks_config),
    pipelineData.container_id,
    pipelineData.config_path,
    JSON.stringify(pipelineData.exposed_ports || []),
    'running',
    new Date()
  ];
  
  const result = await db.query(query, values);
  return result.rows[0];
}

async function getPipelinesFromDatabase() {
  const query = `
    SELECT * FROM custom_pipelines 
    WHERE deleted = false 
    ORDER BY created_at DESC
  `;
  
  const result = await db.query(query);
  return result.rows.map(row => ({
    ...row,
    sources_config: row.sources_config,
    transforms_config: row.transforms_config,
    sinks_config: row.sinks_config,
    exposed_ports: row.exposed_ports
  }));
}

async function getPipelineFromDatabase(id) {
  const query = `
    SELECT * FROM custom_pipelines 
    WHERE id = $1 AND deleted = false
  `;
  
  const result = await db.query(query, [id]);
  if (result.rows.length === 0) return null;
  
  const row = result.rows[0];
  return {
    ...row,
    sources_config: row.sources_config,
    transforms_config: row.transforms_config,
    sinks_config: row.sinks_config,
    exposed_ports: row.exposed_ports
  };
}

async function updatePipelineStatus(id, status, errorMessage = null) {
  const query = `
    UPDATE custom_pipelines 
    SET status = $1, error_message = $2, updated_at = now()
    ${status === 'stopped' ? ', stopped_at = now()' : ''}
    WHERE id = $3
    RETURNING *
  `;
  
  const values = [status, errorMessage, id];
  const result = await db.query(query, values);
  return result.rows[0];
}

async function deletePipelineFromDatabase(id) {
  const query = `
    UPDATE custom_pipelines 
    SET deleted = true, active = false, updated_at = now()
    WHERE id = $1
    RETURNING *
  `;
  
  const result = await db.query(query, [id]);
  return result.rows[0];
}

async function logPipelineAction(pipelineId, action, message, metadata = {}) {
  const query = `
    INSERT INTO custom_pipeline_logs (pipeline_id, action, message, metadata)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;
  
  const values = [pipelineId, action, message, JSON.stringify(metadata)];
  const result = await db.query(query, values);
  return result.rows[0];
}

/*═══════════════════════════════════════════════════════*/
/* Transform Templates                                   */
/*═══════════════════════════════════════════════════════*/
const TRANSFORM_TEMPLATES = {
  parse: yaml.load(fs.readFileSync(rel('../templates/transform_parse.yaml'), 'utf8')),
  enrich: yaml.load(fs.readFileSync(rel('../templates/transform_enrich.yaml'), 'utf8')),
  reduce: yaml.load(fs.readFileSync(rel('../templates/transform_reduce.yaml'), 'utf8'))
};

/*═══════════════════════════════════════════════════════*/
/* Source Builders                                       */
/*═══════════════════════════════════════════════════════*/
function buildSources(sourcesSpec) {
  const sources = {};
  
  for (const [sourceId, sourceConfig] of Object.entries(sourcesSpec)) {
    switch (sourceConfig.type) {
      case 'http':
        sources[sourceId] = {
          type: 'http_server',
          address: `0.0.0.0:${sourceConfig.listen_port || 8088}`
        };
        break;
        
      case 'file':
        sources[sourceId] = {
          type: 'file',
          include: sourceConfig.include || [],
          exclude: sourceConfig.exclude || [],
          ignore_older_secs: sourceConfig.ignore_older_secs || 86400,
          max_read_bytes: sourceConfig.max_read_bytes || 2048,
          // start_at_beginning: sourceConfig.start_at_beginning !== false,
          read_from: 'beginning',
          fingerprint: {
            strategy: sourceConfig.fingerprint_strategy || 'checksum',
            ignored_header_bytes: sourceConfig.ignored_header_bytes || 0
          }
        };
        break;
        
      case 'docker_logs':
        sources[sourceId] = {
          type: 'docker_logs',
          docker_host: sourceConfig.docker_host || 'unix:///var/run/docker.sock',
          include_containers: sourceConfig.include_containers || [],
          exclude_containers: sourceConfig.exclude_containers || [],
          auto_partial_merge: sourceConfig.auto_partial_merge !== false,
          partial_event_marker_field: sourceConfig.partial_event_marker_field || '_partial',
          retry_backoff_secs: sourceConfig.retry_backoff_secs || 2
        };
        break;
        
      case 'prometheus_scrape':
        sources[sourceId] = {
          type: 'prometheus_scrape',
          endpoints: sourceConfig.endpoints || [],
          instance_tag: sourceConfig.instance_tag || 'ScrapeTarget',
          scrape_interval_secs: sourceConfig.scrape_interval_secs || 15
        };
        break;
        
      case 'syslog':
        sources[sourceId] = {
          type: 'syslog',
          mode: sourceConfig.mode || 'tcp',
          address: sourceConfig.address || '0.0.0.0:5514'
        };
        break;
        
      default:
        throw new Error(`Unsupported source type: ${sourceConfig.type}`);
    }
  }
  
  return sources;
}

/*═══════════════════════════════════════════════════════*/
/* Transform Builders                                    */
/*═══════════════════════════════════════════════════════*/
function buildTransforms(transformsSpec, pipelineName = 'custom') {
  const transforms = {};
  
  for (const [sourceId, transformTypes] of Object.entries(transformsSpec)) {
    let previousOutput = sourceId; // Start with source
    
    transformTypes.forEach((transformType, index) => {
      const transformId = `${sourceId}_${transformType}_${index}`;
      
      if (!TRANSFORM_TEMPLATES[transformType]) {
        throw new Error(`Unknown transform type: ${transformType}`);
      }
      
      // Clone template
      const template = JSON.parse(JSON.stringify(TRANSFORM_TEMPLATES[transformType]));
      const transformConfig = template[Object.keys(template)[0]]; // Get first key
      
      // Replace placeholders
      transformConfig.inputs = [previousOutput];
      transformConfig.source = transformConfig.source
        .replace(/DYNAMIC_PIPELINE_NAME/g, pipelineName)
        .replace(/DYNAMIC_SOURCE_TYPE/g, sourceId);
      
      transforms[transformId] = transformConfig;
      previousOutput = transformId; // Chain transforms
    });
  }
  
  return transforms;
}

/*═══════════════════════════════════════════════════════*/
/* Sink Builders                                         */
/*═══════════════════════════════════════════════════════*/
function buildSinks(sinksSpec, transformsSpec) {
  const sinks = {};
  
  for (const [sourceId, sinkConfigs] of Object.entries(sinksSpec)) {
    // Find the last transform for this source
    const sourceTransforms = transformsSpec[sourceId] || [];
    const lastTransformIndex = sourceTransforms.length - 1;
    const inputId = sourceTransforms.length > 0 
      ? `${sourceId}_${sourceTransforms[lastTransformIndex]}_${lastTransformIndex}`
      : sourceId;
    
    sinkConfigs.forEach((sinkConfig, index) => {
      const sinkType = typeof sinkConfig === 'string' ? sinkConfig : sinkConfig.type;
      const sinkId = `${sourceId}_${sinkType}_${index}`;
        switch (sinkType) {
        case 's3':
          // Support both old format (string) and new format (object with config)
          const s3Config = typeof sinkConfig === 'object' ? sinkConfig.config : {};
          
          sinks[sinkId] = {
            type: 'aws_s3',
            inputs: [inputId],
            bucket: s3Config.bucket || 'phucnguyen204', // Default fallback
            region: s3Config.region || 'ap-southeast-2', // Default fallback
            key_prefix: s3Config.key_prefix || `custom-logs/${sourceId}/%Y/%m/%d/`,
            compression: s3Config.compression || 'gzip',
            encoding: { codec: s3Config.encoding || 'json' },
            batch: { 
              max_events: s3Config.max_events || 1, 
              timeout_secs: s3Config.timeout_secs || 10 
            }
          };
          
          // Add AWS credentials if provided
          if (s3Config.access_key_id && s3Config.secret_access_key) {
            sinks[sinkId].auth = {
              access_key_id: s3Config.access_key_id,
              secret_access_key: s3Config.secret_access_key
            };
          }
          break;
          
        case 'console':
          const consoleConfig = typeof sinkConfig === 'object' ? sinkConfig.config : {};
          sinks[sinkId] = {
            type: 'console',
            inputs: [inputId],
            encoding: { codec: consoleConfig.encoding || 'json' }
          };
          break;
          
        case 'elasticsearch':
          const esConfig = typeof sinkConfig === 'object' ? sinkConfig.config : {};
          
          // Validate required fields
          if (!esConfig.endpoints || !Array.isArray(esConfig.endpoints) || esConfig.endpoints.length === 0) {
            throw new Error('Elasticsearch sink requires at least one endpoint');
          }
          
          sinks[sinkId] = {
            type: 'elasticsearch',
            inputs: [inputId],
            endpoints: esConfig.endpoints, // Required: ["http://localhost:9200"]
            index: esConfig.index || `custom-pipeline-${sourceId}-%Y.%m.%d`,
            encoding: { codec: esConfig.encoding || 'json' },
            batch: {
              max_events: esConfig.max_events || 100,
              timeout_secs: esConfig.timeout_secs || 30
            }
          };
          
          // Add authentication if provided
          if (esConfig.username && esConfig.password) {
            sinks[sinkId].auth = {
              strategy: 'basic',
              user: esConfig.username,
              password: esConfig.password
            };
          }
          
          // Add TLS configuration if provided
          if (esConfig.tls) {
            sinks[sinkId].tls = {
              verify_certificate: esConfig.tls.verify_certificate !== false,
              verify_hostname: esConfig.tls.verify_hostname !== false
            };
            
            if (esConfig.tls.ca_file) {
              sinks[sinkId].tls.ca_file = esConfig.tls.ca_file;
            }
          }
          
          // Add additional options
          if (esConfig.doc_type) {
            sinks[sinkId].doc_type = esConfig.doc_type;
          }
          
          if (esConfig.id_key) {
            sinks[sinkId].id_key = esConfig.id_key;
          }
          
          if (esConfig.pipeline) {
            sinks[sinkId].pipeline = esConfig.pipeline;
          }
          
          if (esConfig.headers) {
            sinks[sinkId].headers = esConfig.headers;
          }
          
          if (esConfig.query_params) {
            sinks[sinkId].query = esConfig.query_params;
          }
          
          break;
          
        default:
          throw new Error(`Unsupported sink type: ${sinkType}. Supported types: s3, console, elasticsearch`);
      }
    });
  }
  
  return sinks;
}

/*═══════════════════════════════════════════════════════*/
/* Main Custom Pipeline Function                         */
/*═══════════════════════════════════════════════════════*/
export async function createCustomPipeline(spec) {
  const id = uuidv4();
  const pipelineName = spec.name || `custom_pipeline_${id.slice(0, 8)}`;
  
  try {
    // Validate required fields
    if (!spec.sources || Object.keys(spec.sources).length === 0) {
      throw new Error('At least one source is required');
    }
    
    if (!spec.transforms || Object.keys(spec.transforms).length === 0) {
      throw new Error('At least one transform mapping is required');
    }
    
    if (!spec.sinks || Object.keys(spec.sinks).length === 0) {
      throw new Error('At least one sink mapping is required');
    }
    
    // Build config components
    const sources = buildSources(spec.sources);
    const transforms = buildTransforms(spec.transforms, pipelineName);
    const sinks = buildSinks(spec.sinks, spec.transforms);
    
    // Load base config
    const base = yaml.load(fs.readFileSync(rel('../templates/base.yaml'), 'utf8'));
    
    // Combine all into final config
    const finalConfig = {
      ...base,
      sources,
      transforms,
      sinks
    };
    
    // Write config file
    const yamlPath = path.join(RUNTIME_DIR, `vector_${id}.yaml`);
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
    fs.writeFileSync(yamlPath, yaml.dump(finalConfig));
    
    console.log(`[Custom Pipeline] Configuration written to ${yamlPath}`);
    
    // Prepare exposed ports
    const exposedPorts = [];
    
    // Start container
    const containerName = `vector_${id}`;
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
    
    // Add port mappings for HTTP and Syslog sources
    for (const [sourceId, sourceConfig] of Object.entries(spec.sources)) {
      if (sourceConfig.type === 'http') {
        const port = sourceConfig.listen_port || 8088;
        dockerArgs.push('-p', `${port}:${port}`);
        exposedPorts.push({ source: sourceId, type: 'http', port: port });
        console.log(`[Custom Pipeline] Exposing HTTP port: ${port} for source: ${sourceId}`);
      } else if (sourceConfig.type === 'syslog') {
        const port = sourceConfig.address ? sourceConfig.address.split(':')[1] : '5514';
        dockerArgs.push('-p', `${port}:${port}`);
        exposedPorts.push({ source: sourceId, type: 'syslog', port: parseInt(port) });
        console.log(`[Custom Pipeline] Exposing Syslog port: ${port} for source: ${sourceId}`);
      }
    }
    
    dockerArgs.push(
      'timberio/vector:0.47.0-debian',
      '-c', yamlPath, '--watch-config'
    );
    
    const run = spawnSync('docker', dockerArgs, { encoding: 'utf8' });
    
    if (run.error) {
      throw run.error;
    }
    
    if (run.status !== 0) {
      throw new Error(`Vector container failed: ${run.stderr}`);
    }
    
    const containerId = run.stdout.trim();
    console.log('[Custom Pipeline] Container started:', containerId);
    
    // Prepare pipeline data for database
    const pipelineData = {
      id,
      name: pipelineName,
      description: spec.description || null,
      sources_config: spec.sources,
      transforms_config: spec.transforms,
      sinks_config: spec.sinks,
      container_id: containerId,
      config_path: yamlPath,
      exposed_ports: exposedPorts
    };
    
    // Save to database
    const savedPipeline = await savePipelineToDatabase(pipelineData);
    
    // Log creation action
    await logPipelineAction(id, 'created', `Custom pipeline "${pipelineName}" created successfully`, {
      source_count: Object.keys(spec.sources).length,
      exposed_ports: exposedPorts.length,
      container_id: containerId
    });
    
    return { 
      id, 
      name: pipelineName,
      containerId,
      sources: Object.keys(spec.sources),
      transforms: spec.transforms,
      sinks: spec.sinks,
      exposedPorts,
      status: 'running',
      createdAt: savedPipeline.created_at
    };
    
  } catch (error) {
    // Log error
    try {
      await logPipelineAction(id, 'error', `Failed to create pipeline: ${error.message}`, {
        error: error.message,
        spec: spec
      });
    } catch (logError) {
      console.error('[Custom Pipeline] Failed to log error:', logError);
    }
    
    throw error;
  }
}

/*═══════════════════════════════════════════════════════*/
/* List Custom Pipelines                                 */
/*═══════════════════════════════════════════════════════*/
export async function listCustomPipelines() {
  const pipelines = await getPipelinesFromDatabase();
  
  return pipelines.map(pipeline => ({
    id: pipeline.id,
    name: pipeline.name,
    description: pipeline.description,
    status: pipeline.status,
    source_type: 'custom',
    sink_type: 'mixed',
    config_path: pipeline.config_path,
    container_id: pipeline.container_id,
    created_at: pipeline.created_at,
    started_at: pipeline.started_at,
    stopped_at: pipeline.stopped_at,
    active: pipeline.active,
    deleted: pipeline.deleted,
    exposedPorts: pipeline.exposed_ports,
    sources: Object.keys(pipeline.sources_config || {}),
    transforms: pipeline.transforms_config,
    sinks: pipeline.sinks_config
  }));
}

/*═══════════════════════════════════════════════════════*/
/* Get Custom Pipeline Details                           */
/*═══════════════════════════════════════════════════════*/
export async function getCustomPipelineDetails(id) {
  const pipeline = await getPipelineFromDatabase(id);
  
  if (!pipeline) {
    throw new Error('Custom pipeline not found');
  }
  
  return {
    id: pipeline.id,
    name: pipeline.name,
    description: pipeline.description,
    status: pipeline.status,
    sources_config: pipeline.sources_config,
    transforms_config: pipeline.transforms_config,
    sinks_config: pipeline.sinks_config,
    container_id: pipeline.container_id,
    config_path: pipeline.config_path,
    exposed_ports: pipeline.exposed_ports,
    created_at: pipeline.created_at,
    updated_at: pipeline.updated_at,
    started_at: pipeline.started_at,
    stopped_at: pipeline.stopped_at,
    error_message: pipeline.error_message
  };
}

/*═══════════════════════════════════════════════════════*/
/* Stop Custom Pipeline                                  */
/*═══════════════════════════════════════════════════════*/
export async function stopCustomPipeline(id) {
  try {
    const pipeline = await getPipelineFromDatabase(id);
    
    if (!pipeline) {
      throw new Error('Custom pipeline not found');
    }
    
    if (pipeline.status === 'stopped') {
      throw new Error('Pipeline is already stopped');
    }
    
    const containerId = pipeline.container_id;
    
    // Update status to stopping
    await updatePipelineStatus(id, 'stopping');
    
    // Stop and remove container
    const stopResult = spawnSync('docker', ['stop', containerId], { encoding: 'utf8' });
    const rmResult = spawnSync('docker', ['rm', '-f', containerId], { encoding: 'utf8' });
    
    if (stopResult.error || rmResult.error) {
      console.warn(`[Custom Pipeline] Warning while stopping container ${containerId}:`, 
                   stopResult.error || rmResult.error);
    }
    
    // Update status to stopped
    const updatedPipeline = await updatePipelineStatus(id, 'stopped');
    
    // Log stop action
    await logPipelineAction(id, 'stopped', `Pipeline "${pipeline.name}" stopped successfully`, {
      container_id: containerId,
      stop_time: new Date()
    });
    
    console.log(`[Custom Pipeline] Stopped and removed container: ${containerId}`);
    
    return {
      id,
      name: pipeline.name,
      status: 'stopped',
      stoppedAt: updatedPipeline.stopped_at
    };
    
  } catch (error) {
    // Update status to error
    await updatePipelineStatus(id, 'error', error.message);
    
    // Log error
    await logPipelineAction(id, 'error', `Failed to stop pipeline: ${error.message}`, {
      error: error.message
    });
    
    throw error;
  }
}
