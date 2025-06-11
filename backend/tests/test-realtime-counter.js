#!/usr/bin/env node

/**
 * Test Script for Real-time Log Counter
 * Tests the real-time counting functionality
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:3001/api';
const TEST_LOG_FILE = '/tmp/test_logs.log';

class RealTimeCounterTester {
  constructor() {
    this.pipelineId = null;
  }

  /**
   * Create a test pipeline with HTTP and File sources
   */
  async createTestPipeline() {
    console.log('🔧 Creating test pipeline...');
    
    const pipelineSpec = {
      name: 'Test Real-time Counter Pipeline',
      description: 'Pipeline for testing real-time log counting',
      sources: {
        http_test: {
          type: 'http',
          listen_port: 8080
        },
        file_test: {
          type: 'file',
          include: [TEST_LOG_FILE],
          ignore_older_secs: 60
        }
      },
      transforms: {
        http_test: ['parse'],
        file_test: ['parse']
      },
      sinks: {
        http_test: ['console'],
        file_test: ['console']
      }
    };

    try {
      const response = await fetch(`${API_BASE}/custom-pipelines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pipelineSpec)
      });

      const result = await response.json();
      
      if (result.success) {
        this.pipelineId = result.pipeline.id;
        console.log(`✅ Pipeline created: ${this.pipelineId}`);
        return true;
      } else {
        console.error('❌ Failed to create pipeline:', result.message);
        return false;
      }
    } catch (error) {
      console.error('❌ Error creating pipeline:', error.message);
      return false;
    }
  }

  /**
   * Start real-time monitoring
   */
  async startMonitoring() {
    console.log('🚀 Starting real-time counter...');
    
    try {
      const response = await fetch(`${API_BASE}/realtime-counter/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval_ms: 3000 }) // 3 seconds for faster testing
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Real-time counter started');
        return true;
      } else {
        console.error('❌ Failed to start counter:', result.error);
        return false;
      }
    } catch (error) {
      console.error('❌ Error starting counter:', error.message);
      return false;
    }
  }

  /**
   * Send test logs via HTTP
   */
  async sendHttpLogs(count = 5) {
    console.log(`📡 Sending ${count} HTTP logs...`);
    
    for (let i = 1; i <= count; i++) {
      try {
        const logData = {
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message: `Test HTTP log message ${i}`,
          test_id: i,
          source: 'http_test'
        };

        const response = await fetch('http://localhost:8080', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logData)
        });

        if (response.ok) {
          console.log(`  ✅ HTTP Log ${i} sent successfully`);
        } else {
          console.log(`  ❌ HTTP Log ${i} failed: ${response.status}`);
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.log(`  ❌ HTTP Log ${i} error: ${error.message}`);
      }
    }
  }

  /**
   * Write test logs to file
   */
  async writeFileLogs(count = 5) {
    console.log(`📝 Writing ${count} file logs...`);
    
    // Ensure directory exists
    const dir = path.dirname(TEST_LOG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    for (let i = 1; i <= count; i++) {
      const logLine = JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `Test file log message ${i}`,
        test_id: i,
        source: 'file_test'
      }) + '\n';

      fs.appendFileSync(TEST_LOG_FILE, logLine);
      console.log(`  ✅ File Log ${i} written`);
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  /**
   * Check log counts
   */
  async checkLogCounts() {
    console.log('📊 Checking log counts...');
    
    try {
      const response = await fetch(`${API_BASE}/realtime-counter/summary/${this.pipelineId}`);
      const result = await response.json();
      
      if (result.success) {
        console.log('📈 Current Log Counts:');
        console.log('─'.repeat(50));
        
        Object.entries(result.data.sources).forEach(([sourceId, data]) => {
          console.log(`Source: ${sourceId} (${data.source_type.toUpperCase()})`);
          console.log(`  Total logs: ${data.total_logs_received}`);
          console.log(`  New logs: ${data.new_logs_since_last_check}`);
          console.log(`  Status: ${data.message}`);
          console.log(`  Last updated: ${data.last_updated}`);
          console.log('');
        });
        
        return result.data;
      } else {
        console.error('❌ Failed to get counts:', result.error);
        return null;
      }
    } catch (error) {
      console.error('❌ Error checking counts:', error.message);
      return null;
    }
  }

  /**
   * Force update counters
   */
  async forceUpdate() {
    console.log('🔄 Force updating counters...');
    
    try {
      const response = await fetch(`${API_BASE}/realtime-counter/update/${this.pipelineId}`, {
        method: 'POST'
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Counters updated successfully');
        return true;
      } else {
        console.error('❌ Failed to update counters:', result.error);
        return false;
      }
    } catch (error) {
      console.error('❌ Error updating counters:', error.message);
      return false;
    }
  }

  /**
   * Cleanup test resources
   */
  async cleanup() {
    console.log('🧹 Cleaning up...');
    
    // Stop monitoring
    try {
      await fetch(`${API_BASE}/realtime-counter/stop`, { method: 'POST' });
      console.log('✅ Stopped real-time counter');
    } catch (error) {
      console.log('⚠️ Error stopping counter:', error.message);
    }

    // Delete test pipeline
    if (this.pipelineId) {
      try {
        await fetch(`${API_BASE}/manage/delete/${this.pipelineId}`, { method: 'DELETE' });
        console.log('✅ Deleted test pipeline');
      } catch (error) {
        console.log('⚠️ Error deleting pipeline:', error.message);
      }
    }

    // Remove test file
    if (fs.existsSync(TEST_LOG_FILE)) {
      fs.unlinkSync(TEST_LOG_FILE);
      console.log('✅ Removed test log file');
    }
  }

  /**
   * Run complete test
   */
  async runTest() {
    console.log('🧪 Starting Real-time Log Counter Test');
    console.log('═'.repeat(50));

    try {
      // 1. Create pipeline
      if (!(await this.createTestPipeline())) {
        throw new Error('Failed to create test pipeline');
      }

      // Wait for pipeline to start
      console.log('⏳ Waiting for pipeline to start...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // 2. Start monitoring
      if (!(await this.startMonitoring())) {
        throw new Error('Failed to start monitoring');
      }

      // Wait for monitoring to initialize
      console.log('⏳ Waiting for monitoring to initialize...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 3. Send test logs
      await this.sendHttpLogs(3);
      await this.writeFileLogs(3);

      // 4. Wait for logs to be processed
      console.log('⏳ Waiting for logs to be processed...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // 5. Force update and check counts
      await this.forceUpdate();
      await this.checkLogCounts();

      // 6. Send more logs
      console.log('\n🔄 Sending more logs...');
      await this.sendHttpLogs(2);
      await this.writeFileLogs(2);

      // 7. Wait and check again
      await new Promise(resolve => setTimeout(resolve, 5000));
      await this.forceUpdate();
      const finalCounts = await this.checkLogCounts();

      // 8. Verify results
      if (finalCounts) {
        console.log('🎉 Test Results:');
        console.log('─'.repeat(30));
        
        let httpTotal = 0;
        let fileTotal = 0;
        
        Object.entries(finalCounts.sources).forEach(([sourceId, data]) => {
          if (data.source_type === 'http') {
            httpTotal = data.total_logs_received;
          } else if (data.source_type === 'file') {
            fileTotal = data.total_logs_received;
          }
        });

        console.log(`Expected HTTP logs: 5`);
        console.log(`Actual HTTP logs: ${httpTotal}`);
        console.log(`Expected File logs: 5`);
        console.log(`Actual File logs: ${fileTotal}`);
        
        if (httpTotal >= 5 && fileTotal >= 5) {
          console.log('✅ TEST PASSED: All logs counted correctly!');
        } else {
          console.log('❌ TEST FAILED: Log counts do not match expected values');
        }
      }

    } catch (error) {
      console.error('❌ Test failed:', error.message);
    } finally {
      await this.cleanup();
    }
  }
}

// Run the test
const tester = new RealTimeCounterTester();
tester.runTest().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test crashed:', error);
  process.exit(1);
});
