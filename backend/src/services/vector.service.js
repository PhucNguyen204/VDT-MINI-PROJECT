import fs   from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- helpers ------------------------------------------------------
const rel = p => path.join(__dirname, p);                 // đường dẫn template
const OUT_FILE = '/runtime/configs/vector.yaml';

/**
 * Tạo block source tuỳ theo lựa chọn người dùng.
 * Trả về object { sources:{...}, id: 'source_id' }
 */
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
      };    case 'file':
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
      };    case 'docker_logs':
      const dockerSource = {
        type: 'docker_logs',
        // Connection settings
        docker_host: spec.docker_host || 'unix:///var/run/docker.sock',
        
        // Container filtering - only supported fields
        include_containers: spec.name ? [spec.name] : [],
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
      };default:
      throw new Error(`Unsupported mode: ${spec.mode}`);
  }
}
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
      },      s3_output: {
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

/**
 * Sinh vector.yaml bằng cách ghép base + source + transforms + sinks
 */
export function generateConfig(spec) {
  const srcBlock = buildSource(spec);
  const sinkBlock = buildSink(spec, srcBlock.id);

  // nạp template YAML
  const base = yaml.load(fs.readFileSync(rel('../templates/base.yaml'), 'utf8'));
  const tf   = yaml.load(fs.readFileSync(rel('../templates/transforms.yaml'), 'utf8'));
  // thay thế placeholder INPUT
  tf.transforms.parse_logs.inputs = [srcBlock.id];
    // gộp object YAML với sink tự tạo thay vì template
  const final = { 
    ...base, 
    sources: srcBlock.sources,
    transforms: tf.transforms, 
    ...sinkBlock
  };
  console.log('[Vector] OUT_FILE path:', OUT_FILE);
  console.log('[Vector] Current working directory:', process.cwd());
  console.log('[Vector] __dirname:', __dirname);
  console.log(`[Vector] Using key_prefix: ${sinkBlock.sinks.s3_output.key_prefix} for mode: ${spec.mode}`);
  
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, yaml.dump(final));
  console.log('[Vector] Configuration written to vector.yaml');
}

/**
 * Khởi chạy (hoặc reload) container Vector runtime
 */
export function runVector() {
  // xoá container cũ nếu tồn tại
  spawnSync('docker', ['rm', '-f', 'vector_rt'], { stdio: 'ignore' });

  console.log('[Vector] Starting container with runtime mount from host');
  const dockerArgs = [
    'run', '-d',
    '--name', 'vector_rt',
    '--network', 'demo_vdt_vector-network',
    '-e', `AWS_ACCESS_KEY_ID=${process.env.AWS_ACCESS_KEY_ID}`,
    '-e', `AWS_SECRET_ACCESS_KEY=${process.env.AWS_SECRET_ACCESS_KEY}`,
    '-e', `AWS_DEFAULT_REGION=${process.env.AWS_DEFAULT_REGION}`,
    '--volumes-from', 'demo_vdt-api-1',
    // Mount Docker socket for docker_logs source
    '-v', '/var/run/docker.sock:/var/run/docker.sock:ro',
    '-p', '8686:8686',
    '-p', '8088:8088',
    'timberio/vector:0.47.0-debian',
    '-c', '/runtime/configs/vector.yaml', '--watch-config'
  ];

  const result = spawnSync('docker', dockerArgs, { encoding: 'utf8' });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Vector container failed: ${result.stderr}`);
  }

  const containerId = result.stdout.trim();
  console.log('[Vector] Container started:', containerId);
  return containerId;
}
