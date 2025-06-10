// Base Repository Class
// Cung cấp các method cơ bản cho tất cả repositories

import { repoLogger } from '../configs/logger.js';

export class BaseRepository {
  constructor(db, tableName) {
    this.db = db;
    this.tableName = tableName;
    this.logger = repoLogger;
  }
  /**
   * Find record by ID
   * @param {string} id - Record ID
   * @returns {Object|null} Record or null if not found
   */
  async findById(id) {
    const startTime = Date.now();
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE id = $1 AND deleted = false`;
      this.logger.debug(`Executing findById query on ${this.tableName}`, { id, query });
      
      const result = await this.db.query(query, [id]);
      const duration = Date.now() - startTime;
      
      this.logger.debug(`FindById completed on ${this.tableName}`, { 
        id, 
        found: !!result.rows[0],
        duration: `${duration}ms`
      });
      
      return result.rows[0] || null;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`FindById failed on ${this.tableName}`, {
        id,
        error: error.message,
        duration: `${duration}ms`
      });
      throw error;
    }
  }
  /**
   * Find all records with optional conditions
   * @param {Object} conditions - Where conditions
   * @param {Object} options - Query options (limit, offset, orderBy)
   * @returns {Array} Array of records
   */
  async findAll(conditions = {}, options = {}) {
    const startTime = Date.now();
    try {
      let query = `SELECT * FROM ${this.tableName} WHERE deleted = false`;
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
        query += ` ORDER BY created_at DESC`;
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

      this.logger.debug(`Executing findAll query on ${this.tableName}`, { 
        conditions, 
        options, 
        query 
      });

      const result = await this.db.query(query, values);
      const duration = Date.now() - startTime;
      
      this.logger.debug(`FindAll completed on ${this.tableName}`, {
        conditions,
        options,
        count: result.rows.length,
        duration: `${duration}ms`
      });

      return result.rows;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`FindAll failed on ${this.tableName}`, {
        conditions,
        options,
        error: error.message,
        duration: `${duration}ms`
      });
      throw error;
    }
  }
  /**
   * Create new record
   * @param {Object} data - Record data
   * @returns {Object} Created record
   */
  async create(data) {
    const startTime = Date.now();
    try {
      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');

      const query = `
        INSERT INTO ${this.tableName} (${columns.join(', ')})
        VALUES (${placeholders})
        RETURNING *
      `;

      this.logger.debug(`Executing create query on ${this.tableName}`, { 
        columns, 
        query 
      });

      const result = await this.db.query(query, values);
      const duration = Date.now() - startTime;
      
      this.logger.info(`Record created in ${this.tableName}`, {
        id: result.rows[0]?.id,
        duration: `${duration}ms`
      });

      return result.rows[0];
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Create failed on ${this.tableName}`, {
        data: Object.keys(data),
        error: error.message,
        duration: `${duration}ms`
      });
      throw error;
    }
  }
  /**
   * Update record by ID
   * @param {string} id - Record ID
   * @param {Object} data - Update data
   * @returns {Object} Updated record
   */
  async update(id, data) {
    const startTime = Date.now();
    try {
      const columns = Object.keys(data);
      const values = Object.values(data);
      const setClause = columns.map((col, index) => `${col} = $${index + 2}`).join(', ');

      const query = `
        UPDATE ${this.tableName}
        SET ${setClause}, updated_at = now()
        WHERE id = $1 AND deleted = false
        RETURNING *
      `;

      this.logger.debug(`Executing update query on ${this.tableName}`, { 
        id, 
        columns, 
        query 
      });

      const result = await this.db.query(query, [id, ...values]);
      const duration = Date.now() - startTime;
      
      if (result.rows[0]) {
        this.logger.info(`Record updated in ${this.tableName}`, {
          id,
          updatedFields: columns,
          duration: `${duration}ms`
        });
      } else {
        this.logger.warn(`Update failed - record not found in ${this.tableName}`, {
          id,
          duration: `${duration}ms`
        });
      }

      return result.rows[0];
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Update failed on ${this.tableName}`, {
        id,
        data: Object.keys(data),
        error: error.message,
        duration: `${duration}ms`
      });
      throw error;
    }
  }
  /**
   * Soft delete record by ID
   * @param {string} id - Record ID
   * @returns {Object} Deleted record
   */
  async softDelete(id) {
    const startTime = Date.now();
    try {
      const query = `
        UPDATE ${this.tableName}
        SET deleted = true, active = false, updated_at = now()
        WHERE id = $1
        RETURNING *
      `;

      this.logger.debug(`Executing soft delete query on ${this.tableName}`, { id, query });

      const result = await this.db.query(query, [id]);
      const duration = Date.now() - startTime;
      
      if (result.rows[0]) {
        this.logger.info(`Record soft deleted in ${this.tableName}`, {
          id,
          duration: `${duration}ms`
        });
      } else {
        this.logger.warn(`Soft delete failed - record not found in ${this.tableName}`, {
          id,
          duration: `${duration}ms`
        });
      }

      return result.rows[0];
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Soft delete failed on ${this.tableName}`, {
        id,
        error: error.message,
        duration: `${duration}ms`
      });
      throw error;
    }
  }

  /**
   * Execute custom query
   * @param {string} query - SQL query
   * @param {Array} values - Query parameters
   * @returns {Object} Query result
   */
  async executeQuery(query, values = []) {
    const startTime = Date.now();
    try {
      this.logger.debug(`Executing custom query on ${this.tableName}`, { query });
      
      const result = await this.db.query(query, values);
      const duration = Date.now() - startTime;
      
      this.logger.debug(`Custom query completed on ${this.tableName}`, {
        query,
        rowCount: result.rowCount,
        duration: `${duration}ms`
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Custom query failed on ${this.tableName}`, {
        query,
        values,
        error: error.message,
        duration: `${duration}ms`
      });
      throw error;
    }
  }
}
