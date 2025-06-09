// Test script for custom S3 configuration
const testPayload = {
  name: "test-user-s3-config",
  description: "Testing user-provided S3 configuration",
  sources: {
    web_traffic: {
      type: "http",
      address: "0.0.0.0:8090",
      encoding: "json"
    }
  },
  transforms: {
    web_traffic: ["enrich"]
  },
  sinks: {
    web_traffic: [
      {
        type: "s3",
        config: {
          bucket: "my-custom-bucket",
          region: "eu-west-1",
          access_key_id: "AKIA...", 
          secret_access_key: "your-secret-key",
          key_prefix: "logs/my-app/%Y/%m/%d/",
          compression: "gzip",
          encoding: "json",
          max_events: 100,
          timeout_secs: 30
        }
      },
      "console"
    ]
  }
};

console.log("Test payload for custom S3 configuration:");
console.log(JSON.stringify(testPayload, null, 2));
