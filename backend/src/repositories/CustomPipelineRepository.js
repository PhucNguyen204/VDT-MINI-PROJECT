import { BaseRepository } from './BaseRepository.js';

/**
 * Custom Pipeline Repository
 * Handles all database operations for custom_pipelines table
 */
export class CustomPipelineRepository extends BaseRepository {
  constructor(db) {
    super(db, 'custom_pipelines');
  }

  /**
   * Find pipeline by ID with parsed JSON fields
   * @param {string} id - Pipeline ID
   * @returns {Object|null} Pipeline with parsed configurations
   */
  async findById(id) {
    const pipeline = await super.findById(id);
    if (!pipeline) return null;
    return this.parseJsonFields(pipeline);
  }

  /**
   * Find all pipelines with parsed JSON fields
   * @param {Object} conditions - Where conditions
   * @param {Object} options - Query options
   * @returns {Array} Array of pipelines with parsed configurations
   */
  async findAll(conditions = {}, options = {}) {
    const pipelines = await super.findAll(conditions, options);
    return pipelines.map(pipeline => this.parseJsonFields(pipeline));
  }

  /**
   * Create new pipeline with JSON stringification
   * @param {Object} data - Pipeline data
   * @returns {Object} Created pipeline with parsed configurations
   */
  async create(data) {
    const processedData = this.stringifyJsonFields(data);
    const pipeline = await super.create(processedData);
    return this.parseJsonFields(pipeline);
  }

  /**
   * Update pipeline with JSON stringification
   * @param {string} id - Pipeline ID
   * @param {Object} data - Update data
   * @returns {Object} Updated pipeline with parsed configurations
   */
  async update(id, data) {
    const processedData = this.stringifyJsonFields(data);
    const pipeline = await super.update(id, processedData);
    return pipeline ? this.parseJsonFields(pipeline) : null;
  }

  /**
   * Find pipelines by status
   * @param {string} status - Pipeline status
   * @returns {Array} Array of pipelines
   */
  async findByStatus(status) {
    return await this.findAll({ status });
  }

  /**
   * Update pipeline status with timestamps
   * @param {string} id - Pipeline ID
   * @param {string} status - New status
   * @param {string} errorMessage - Error message (optional)
   * @returns {Object} Updated pipeline
   */
  async updateStatus(id, status, errorMessage = null) {
    let query = `
      UPDATE ${this.tableName} 
      SET status = $1, error_message = $2, updated_at = now()
    `;
    const values = [status, errorMessage];

    // Add timestamp updates based on status
    if (status === 'stopped') {
      query += ', stopped_at = now()';
    } else if (status === 'running') {
      query += ', started_at = now(), stopped_at = null';
    }

    query += ' WHERE id = $3 RETURNING *';
    values.push(id);

    const result = await this.executeQuery(query, values);
    return result.rows[0] ? this.parseJsonFields(result.rows[0]) : null;
  }

  /**
   * Set pipeline container ID
   * @param {string} id - Pipeline ID
   * @param {string} containerId - Container ID
   * @returns {Object} Updated pipeline
   */
  async setContainerId(id, containerId) {
    return await this.update(id, { container_id: containerId });
  }

  /**
   * Set pipeline config path
   * @param {string} id - Pipeline ID
   * @param {string} configPath - Config file path
   * @returns {Object} Updated pipeline
   */
  async setConfigPath(id, configPath) {
    return await this.update(id, { config_path: configPath });
  }

  /**
   * Parse JSON fields from database
   * @private
   * @param {Object} pipeline - Raw pipeline from database
   * @returns {Object} Pipeline with parsed JSON fields
   */
  parseJsonFields(pipeline) {
    return {
      ...pipeline,
      sources_config: pipeline.sources_config || {},
      transforms_config: pipeline.transforms_config || {},
      sinks_config: pipeline.sinks_config || {},
      exposed_ports: pipeline.exposed_ports || []
    };
  }

  /**
   * Stringify JSON fields for database storage
   * @private
   * @param {Object} data - Pipeline data
   * @returns {Object} Data with stringified JSON fields
   */
  stringifyJsonFields(data) {
    const processed = { ...data };
    
    if (data.sources_config && typeof data.sources_config === 'object') {
      processed.sources_config = JSON.stringify(data.sources_config);
    }
    if (data.transforms_config && typeof data.transforms_config === 'object') {
      processed.transforms_config = JSON.stringify(data.transforms_config);
    }
    if (data.sinks_config && typeof data.sinks_config === 'object') {
      processed.sinks_config = JSON.stringify(data.sinks_config);
    }
    if (data.exposed_ports && Array.isArray(data.exposed_ports)) {
      processed.exposed_ports = JSON.stringify(data.exposed_ports);
    }
    
    return processed;
  }
}
