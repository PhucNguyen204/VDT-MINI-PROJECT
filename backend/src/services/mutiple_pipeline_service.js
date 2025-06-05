/* backend/src/services/vector.service.js */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { spawnSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { db } from '../configs/db.js';              // pg Pool đã cấu hình
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/*═══════════════════════════════════════════════════════*/
/* Helpers                                               */
/*═══════════════════════════════════════════════════════*/
const rel = p => path.join(__dirname, p);                 // đường dẫn template
const RUNTIME_DIR = '/runtime/configs';

/*═══════════════════════════════════════════════════════*/
/* 1. Build source block                                 */
/*═══════════════════════════════════════════════════════*/
function buildSource(spec) {
  switch (spec.mode) {
    case 'push_syslog':
      return {
        sources: {
          syslog_in: {
            type: 'syslog',
            mode: 'tcp',
            address: '0.0.0.0:5514'
          }
        },
        id: 'syslog_in'
      };

    case 'push_http':
      return {
        sources: {
          http_in: {
            type: 'http_server',
            address: `0.0.0.0:${spec.listen_port || 8088}`
          }
        },
        id: 'http_in'
      };

    case 'pull_s3':
      return {
        sources: {
          s3_in: {
            type: 'aws_s3',
            bucket: spec.bucket,
            region: spec.region,
            scan_interval_secs: spec.interval_secs || 60,
            compression: 'auto'
          }
        },
        id: 's3_in'
      };

    case 'file':
      return {
        sources: {
          file_in: {
            type: 'file',
            include: spec.include || ['/runtime/logs/**/*.log'],
            exclude: spec.exclude || [],
            // Tùy chọn bổ sung
            read_from: spec.read_from || 'beginning', // 'beginning' | 'end'
            ignore_older_secs: spec.ignore_older_secs || 86400, // 24h
            max_read_bytes: spec.max_read_bytes || 2048,
            start_at_beginning: spec.start_at_beginning !== false,
            fingerprint: {
              strategy: spec.fingerprint_strategy || 'checksum',
              ignored_header_bytes: spec.ignored_header_bytes || 0
            },
            // Multiline support
            multiline: spec.multiline ? {
              start_pattern: spec.multiline.start_pattern,
              mode: spec.multiline.mode || 'halt_before',
              condition_pattern: spec.multiline.condition_pattern,
              timeout_ms: spec.multiline.timeout_ms || 1000
            } : undefined
          }
        },
        id: 'file_in'
      };

    case 'docker_logs':
      const dockerSource = {
        type: 'docker_logs',
        // Connection settings
        docker_host: spec.docker_host || 'unix:///var/run/docker.sock',
        
        // Container filtering - only supported fields
        include_containers: spec.include_containers || [],
        exclude_containers: spec.exclude_containers || [],
        
        // Partial message handling
        auto_partial_merge: spec.auto_partial_merge !== false,
        partial_event_marker_field: spec.partial_event_marker_field || '_partial',
        
        // Performance settings
        retry_backoff_secs: spec.retry_backoff_secs || 2
      };
      
      // Only add include_labels if explicitly provided and not empty
      if (spec.include_labels && Array.isArray(spec.include_labels) && spec.include_labels.length > 0) {
        dockerSource.include_labels = spec.include_labels;
      }
      
      return {
        sources: {
          docker_in: dockerSource
        },
        id: 'docker_in'
      };

    default:
      throw new Error(`Unsupported mode: ${spec.mode}`);
  }
}

/*═══════════════════════════════════════════════════════*/
/* 2. Build sink block                                   */
/*═══════════════════════════════════════════════════════*/
/**
 * Tạo sinks tuỳ theo source type với key_prefix khác nhau
 */
function buildSink(spec, sourceId) {
  // Xác định key_prefix dựa trên source type
  let keyPrefix;
  switch (spec.mode) {
    case 'push_http':
      keyPrefix = 'http-logs/%Y/%m/%d/';
      break;
    case 'file':
      keyPrefix = 'file-logs/%Y/%m/%d/';
      break;
    case 'docker_logs':
      keyPrefix = 'docker-logs/%Y/%m/%d/';
      break;
    case 'push_syslog':
      keyPrefix = 'syslog-logs/%Y/%m/%d/';
      break;
    case 'pull_s3':
      keyPrefix = 's3-logs/%Y/%m/%d/';
      break;
    default:
      keyPrefix = 'demo/%Y/%m/%d/';
  }

  return {
    sinks: {
      console_debug: {
        type: 'console',
        inputs: ['reduce_keep'],
        encoding: {
          codec: 'json'
        }
      },
      s3_output: {
        type: 'aws_s3',
        inputs: ['reduce_keep'],
        bucket: 'phucnguyen204',
        region: 'ap-southeast-2',
        key_prefix: keyPrefix,
        compression: 'gzip',
        encoding: {
          codec: 'json'
        },
        batch: {
          max_events: 1,
          timeout_secs: 10
        }
      }
    }
  };
}

/*═══════════════════════════════════════════════════════*/
/* 3. Gộp YAML & ghi file                                */
/*═══════════════════════════════════════════════════════*/
function writeVectorYaml(spec, sourceId, yamlPath) {
  const base = yaml.load(fs.readFileSync(rel('../templates/base.yaml'), 'utf8'));
  const tf   = yaml.load(fs.readFileSync(rel('../templates/transforms.yaml'), 'utf8'));
  tf.transforms.parse_logs.inputs = [sourceId];

  const sinkBlock = buildSink(spec, sourceId);
  
  const full = {
    ...base,
    sources: spec._sources,
    transforms: tf.transforms,
    ...sinkBlock  // This now includes the 'sinks' wrapper
  };

  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  fs.writeFileSync(yamlPath, yaml.dump(full));
  console.log(`[Multiple Pipeline] Configuration written to ${yamlPath}`);
  console.log(`[Multiple Pipeline] Using key_prefix: ${sinkBlock.sinks.s3_output.key_prefix} for mode: ${spec.mode}`);
}

/*═══════════════════════════════════════════════════════*/
/* 4. Create pipeline (public)                           */
/*═══════════════════════════════════════════════════════*/
export async function createPipeline(spec) {
  // ---- 4.1  Generate ID & build source
  const id              = uuidv4();
  const { id: srcId, sources } = buildSource(spec);
  spec._sources         = sources;
  
  const yamlPath        = path.join(RUNTIME_DIR, `vector_${id}.yaml`); // Container path for writing and execution
  const containerName   = `vector_${id}`;
  
  // ---- 4.2  Write YAML file
  writeVectorYaml(spec, srcId, yamlPath);
  
  // ---- 4.3  Run container
  console.log('[Multiple Pipeline] Starting container with runtime mount from host');
  const dockerArgs = [
    'run', '-d',
    '--name', containerName,
    '--network', 'demo_vdt_vector-network',
    '-e', `AWS_ACCESS_KEY_ID=${process.env.AWS_ACCESS_KEY_ID}`,
    '-e', `AWS_SECRET_ACCESS_KEY=${process.env.AWS_SECRET_ACCESS_KEY}`,
    '-e', `AWS_DEFAULT_REGION=${process.env.AWS_DEFAULT_REGION}`,
    '--volumes-from', 'demo_vdt_api',
    // Mount Docker socket for docker_logs source
    '-v', '/var/run/docker.sock:/var/run/docker.sock:ro',
    'timberio/vector:0.47.0-debian',
    '-c', yamlPath, '--watch-config'
  ];

  const run = spawnSync('docker', dockerArgs, { encoding: 'utf8' });

  if (run.error) {
    throw run.error;
  }

  if (run.status !== 0) {
    throw new Error(`Vector container failed: ${run.stderr}`);
  }

  const containerId = run.stdout.trim();
  console.log('[Multiple Pipeline] Container started:', containerId);
    // ---- 4.4  Save DB metadata
  await db.query(
    `INSERT INTO pipelines(id,name,source_type,sink_type,config_path,container_id,deleted)
     VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [id, spec.name || `pipeline_${id.slice(0,8)}`, spec.mode, 'aws_s3', yamlPath, containerId, false]
  );
  return { id, containerId };
}

/*═══════════════════════════════════════════════════════*/
/* 5. Stop (delete) pipeline                              */
/*═══════════════════════════════════════════════════════*/
export async function stopPipeline(id) {
  const { rows } = await db.query(
    'SELECT container_id FROM pipelines WHERE id=$1 AND active=true AND deleted=false',[id]
  );
  if (!rows.length) throw new Error('Pipeline not found or already stopped/deleted');

  const cid = rows[0].container_id;
  spawnSync('docker',['stop',cid],{stdio:'ignore'});
  spawnSync('docker',['rm','-f',cid],{stdio:'ignore'});

  await db.query(
    'UPDATE pipelines SET active=false, deleted=true, stopped_at=now() WHERE id=$1',[id]
  );
  return { id, status:'deleted' };
}

/*═══════════════════════════════════════════════════════*/
/* 6. Liệt kê                                             */
/*═══════════════════════════════════════════════════════*/
export async function listPipelines() {
  const { rows } = await db.query(
    'SELECT * FROM pipelines WHERE deleted=false ORDER BY created_at DESC'
  );
  return rows;
}
