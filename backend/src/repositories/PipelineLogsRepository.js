import { BaseRepository } from './BaseRepository.js';

/**
 * Pipeline Logs Repository
 * Handles all database operations for custom_pipeline_logs table
 */
export class PipelineLogsRepository extends BaseRepository {
  constructor(db) {
    super(db, 'custom_pipeline_logs');
  }

  /**
   * Create log entry for pipeline action
   * @param {string} pipelineId - Pipeline ID
   * @param {string} action - Action performed
   * @param {string} message - Log message
   * @param {string} logLevel - Log level (INFO, WARN, ERROR)
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Created log entry
   */
  async logAction(pipelineId, action, message, logLevel = 'INFO', metadata = {}) {
    const logData = {
      pipeline_id: pipelineId,
      action,
      message,
      log_level: logLevel,
      metadata: JSON.stringify(metadata),
      timestamp: new Date()
    };

    return await this.create(logData);
  }

  /**
   * Find logs by pipeline ID
   * @param {string} pipelineId - Pipeline ID
   * @param {Object} options - Query options
   * @returns {Array} Array of log entries
   */
  async findByPipelineId(pipelineId, options = {}) {
    const conditions = { pipeline_id: pipelineId };
    const queryOptions = {
      ...options,
      orderBy: options.orderBy || 'timestamp DESC'
    };

    const logs = await this.findAll(conditions, queryOptions);
    return logs.map(log => this.parseMetadata(log));
  }

  /**
   * Parse metadata JSON field
   * @private
   * @param {Object} log - Raw log from database
   * @returns {Object} Log with parsed metadata
   */
  parseMetadata(log) {
    return {
      ...log,
      metadata: typeof log.metadata === 'string' ? 
        JSON.parse(log.metadata || '{}') : 
        log.metadata || {}
    };
  }

  /**
   * Override base findAll to exclude deleted column check (logs don't have deleted column)
   */
  async findAll(conditions = {}, options = {}) {
    let query = `SELECT * FROM ${this.tableName} WHERE 1=1`;
    const values = [];
    let paramIndex = 1;

    // Add conditions
    Object.entries(conditions).forEach(([key, value]) => {
      query += ` AND ${key} = $${paramIndex}`;
      values.push(value);
      paramIndex++;
    });

    // Add ordering
    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy}`;
    } else {
      query += ` ORDER BY timestamp DESC`;
    }

    // Add pagination
    if (options.limit) {
      query += ` LIMIT $${paramIndex}`;
      values.push(options.limit);
      paramIndex++;
    }

    if (options.offset) {
      query += ` OFFSET $${paramIndex}`;
      values.push(options.offset);
    }

    const result = await this.db.query(query, values);
    return result.rows;
  }

  /**
   * Override base create to handle logs table structure
   */
  async create(data) {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');

    const query = `
      INSERT INTO ${this.tableName} (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    return result.rows[0];
  }
}
