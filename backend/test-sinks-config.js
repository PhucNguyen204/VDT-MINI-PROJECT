// Test script for new sink configurations (S3, Console, Elasticsearch)
const sinkTestConfigs = {
  // Test S3 with user config
  s3_user_config: {
    type: "s3",
    config: {
      bucket: "my-custom-bucket",
      region: "us-east-1",
      access_key_id: "AKIAIOSFODNN7EXAMPLE",
      secret_access_key: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      key_prefix: "logs/production/",
      compression: "gzip",
      encoding: "json"
    }
  },
  
  // Test Console
  console_default: {
    type: "console"
  },
  
  console_custom: {
    type: "console",
    config: {
      encoding: "text"
    }
  },
  
  // Test Elasticsearch
  elasticsearch_basic: {
    type: "elasticsearch",
    config: {
      endpoints: ["http://localhost:9200"],
      index: "my-logs-%Y.%m.%d"
    }
  },
  
  elasticsearch_with_auth: {
    type: "elasticsearch", 
    config: {
      endpoints: ["https://elasticsearch.example.com:9200"],
      index: "production-logs-%Y.%m.%d",
      username: "elastic",
      password: "changeme",
      tls: {
        verify_certificate: true,
        verify_hostname: true
      },
      doc_type: "_doc",
      headers: {
        "X-Custom-Header": "value"
      },
      query_params: {
        "refresh": "true"
      }
    }
  },
  
  elasticsearch_cloud: {
    type: "elasticsearch",
    config: {
      endpoints: ["https://my-cloud.es.amazonaws.com:443"],
      index: "aws-logs-%Y.%m.%d", 
      username: "elastic",
      password: "secret",
      tls: {
        verify_certificate: true
      },
      pipeline: "my-ingest-pipeline",
      batch: {
        max_events: 500,
        timeout_secs: 60
      }
    }
  }
};

// Test payload for pipeline creation
const testPipelinePayload = {
  name: "test-multi-sink-pipeline",
  description: "Test pipeline with S3, Console and Elasticsearch sinks",
  sources: {
    web_traffic: {
      type: "http",
      address: "0.0.0.0:8090",
      path: "/webhook"
    }
  },
  transforms: {
    web_traffic: [
      { type: "parse", parser: "json" },
      { type: "enrich" }
    ]
  },
  sinks: {
    web_traffic: [
      {
        type: "s3",
        config: {
          bucket: "my-production-logs",
          region: "us-west-2", 
          access_key_id: "AKIAIOSFODNN7EXAMPLE",
          secret_access_key: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
          key_prefix: "web-logs/%Y/%m/%d/",
          compression: "gzip"
        }
      },
      {
        type: "console",
        config: {
          encoding: "json"
        }
      },
      {
        type: "elasticsearch",
        config: {
          endpoints: ["http://localhost:9200"],
          index: "web-traffic-%Y.%m.%d",
          username: "elastic",
          password: "changeme"
        }
      }
    ]
  }
};

console.log("=== SINK TEST CONFIGURATIONS ===");
console.log(JSON.stringify(sinkTestConfigs, null, 2));

console.log("\n=== TEST PIPELINE PAYLOAD ===");
console.log(JSON.stringify(testPipelinePayload, null, 2));

export { sinkTestConfigs, testPipelinePayload };
