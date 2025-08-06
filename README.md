# Vector Pipeline System (VDT)

Hệ thống quản lý và giám sát pipeline xử lý dữ liệu sử dụng Vector, được xây dựng với Node.js backend và React frontend.

## 📋 Mục lục

- [Tổng quan](#tổng-quan)
- [Kiến trúc hệ thống](#kiến-trúc-hệ-thống)
- [Cài đặt và chạy](#cài-đặt-và-chạy)
- [API Documentation](#api-documentation)
- [Frontend Features](#frontend-features)
- [Monitoring & Metrics](#monitoring--metrics)
- [Development](#development)
- [Troubleshooting](#troubleshooting)

## 🎯 Tổng quan

Vector Pipeline System là một nền tảng quản lý pipeline xử lý dữ liệu thời gian thực, cho phép:

- **Tạo pipeline tùy chỉnh** với nhiều nguồn dữ liệu (HTTP, File, Docker Logs, Syslog)
- **Giám sát real-time** với metrics chi tiết (CPU, Memory, Network, Throughput)
- **Quản lý lifecycle** pipeline (start, stop, restart, delete)
- **Dashboard trực quan** với biểu đồ và thống kê
- **Tự động thu thập metrics** với scheduler

## 🏗️ Kiến trúc hệ thống

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   PostgreSQL    │
│   (React)       │◄──►│   (Node.js)     │◄──►│   Database      │
│   Port: 80      │    │   Port: 3000    │    │   Port: 5432    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Vector        │
                       │   Containers    │
                       │   (Docker)      │
                       └─────────────────┘
```

### Công nghệ sử dụng

**Backend:**
- Node.js/Express
- PostgreSQL
- Docker API
- Winston Logger
- YAML Configuration

**Frontend:**
- React/TypeScript
- Tailwind CSS
- Zustand (State Management)
- Recharts (Charts)
- Axios (HTTP Client)

**Infrastructure:**
- Docker Compose
- Vector (Data Pipeline)
- AWS S3 Integration

## 🚀 Cài đặt và chạy

### Yêu cầu hệ thống

- Docker & Docker Compose
- Node.js 18+
- Git

### 1. Clone repository

```bash
git clone <repository-url>
cd demo_VDT
```

### 2. Cấu hình environment

Tạo file `.env` trong thư mục gốc:

```env
# Database Configuration
PG_HOST=postgres
PG_PORT=5432
PG_USER=vector
PG_PASSWORD=vectorpwd
PG_DB=pipelines

# AWS Configuration (cho S3 sinks)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_DEFAULT_REGION=ap-southeast-2

# Application Configuration
NODE_ENV=development
LOG_LEVEL=info
```

### 3. Khởi động hệ thống

```bash
# Xóa toàn bộ container cũ (nếu có)
docker-compose down

# Build và chạy hệ thống
docker-compose up -d --build

# Kiểm tra trạng thái
docker-compose ps
```

### 4. Truy cập ứng dụng

- **Frontend:** http://localhost
- **Backend API:** http://localhost:3000
- **Database:** localhost:5432

## 📚 API Documentation

### Custom Pipelines

#### Tạo pipeline mới
```bash
POST /api/custom-pipelines
```

**Ví dụ request body:**
```json
{
  "name": "dual-source-pipeline",
  "sources": {
    "file_source": {
      "type": "file",
      "include": ["D:/demo_VDT/runtime/logs/*.log"]
    },
    "http_source": {
      "type": "http",
      "listen_port": 8090
    }
  },
  "transforms": {
    "file_source": ["parse", "enrich"],
    "http_source": ["parse", "enrich"]
  },
  "sinks": {
    "file_source": [
      {
        "type": "s3",
        "config": {
          "bucket": "phucnguyen204file",
          "region": "ap-southeast-2",
          "access_key_id": "AKIA5YG3CCI7MXG5KIE7",
          "secret_access_key": "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"
        }
      }
    ],
    "http_source": [
      {
        "type": "s3",
        "config": {
          "bucket": "phucnguyenhttp",
          "region": "ap-southeast-2",
          "access_key_id": "AKIA5YG3CCI7MXG5KIE7",
          "secret_access_key": "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"
        }
      }
    ]
  }
}
```

#### Lấy danh sách pipeline
```bash
GET /api/custom-pipelines
```

#### Lấy chi tiết pipeline
```bash
GET /api/custom-pipelines/:id
```

#### Xóa pipeline
```bash
DELETE /api/custom-pipelines/:id
```

### Pipeline Management

#### Dừng pipeline
```bash
POST /api/manage/stop/:id
```

#### Khởi động lại pipeline
```bash
POST /api/manage/restart/:id
```

#### Xóa pipeline
```bash
DELETE /api/manage/delete/:id
```

#### Lấy trạng thái pipeline
```bash
GET /api/manage/status/:id
```

#### Lấy tất cả pipeline
```bash
GET /api/manage/all
```

### Monitoring & Metrics

#### Thu thập metrics cho pipeline cụ thể
```bash
POST /api/custom-monitoring/collect/:id
```

#### Thu thập metrics cho tất cả pipeline
```bash
POST /api/custom-monitoring/collect-all
```

#### Lấy metrics lịch sử
```bash
GET /api/custom-monitoring/metrics/:id?timeRange=1h&category=prometheus&limit=100
```

#### Lấy dashboard data
```bash
GET /api/custom-monitoring/dashboard/:id?timeRange=1h
```

#### Lấy tổng quan hệ thống
```bash
GET /api/custom-monitoring/overview?timeRange=1h
```

#### Kiểm tra health
```bash
GET /api/custom-monitoring/health/:id
```

#### Xóa metrics
```bash
DELETE /api/custom-monitoring/metrics/:id
```

### Scheduler (Tự động thu thập metrics)

#### Bắt đầu scheduler
```bash
POST /api/scheduler/start
Body: { "interval_seconds": 30 }
```

#### Dừng scheduler
```bash
POST /api/scheduler/stop
```

#### Cập nhật interval
```bash
PUT /api/scheduler/interval
Body: { "interval_seconds": 60 }
```

#### Lấy trạng thái scheduler
```bash
GET /api/scheduler/status
```

#### Trigger thu thập thủ công
```bash
POST /api/scheduler/trigger
```

## 🎨 Frontend Features

### Dashboard
- Tổng quan hệ thống với thống kê pipeline
- Biểu đồ real-time metrics
- Danh sách pipeline với trạng thái

### Pipeline Creation
- Wizard tạo pipeline với 3 bước
- Hỗ trợ nhiều loại source (HTTP, File, Docker Logs, Syslog)
- Cấu hình transforms (Parse, Enrich, Reduce)
- Cấu hình sinks (S3, Console, Elasticsearch)

### Pipeline Monitoring
- Metrics real-time với auto-refresh
- Biểu đồ lịch sử metrics
- Health status monitoring
- Container statistics (CPU, Memory, Network, I/O)

### Auto Collection
- Cài đặt interval tự động thu thập metrics
- Countdown timer hiển thị thời gian còn lại
- Tùy chọn 10s, 30s, 60s, 5min, 15min

### Historical Metrics
- Line charts cho từng loại metric
- Tùy chọn số lượng data points (10, 20, 50)
- Metrics: CPU Usage, Network Rx/Tx, Block Read/Write, Health

## 📊 Monitoring & Metrics

### Loại metrics được thu thập

1. **Prometheus Metrics**
   - Events throughput
   - Error rates
   - Buffer usage
   - Component statistics

2. **Container Stats**
   - CPU usage percentage
   - Memory usage (MB)
   - Network I/O (bytes)
   - Block I/O (bytes)

3. **Health Status**
   - Pipeline health (healthy/unhealthy)
   - API connectivity
   - Container status

4. **GraphQL Metrics**
   - Detailed component statistics
   - Source/sink performance
   - Transform processing

### Database Schema

```sql
-- Custom pipelines table
CREATE TABLE custom_pipelines (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sources_config JSONB NOT NULL,
  transforms_config JSONB NOT NULL,
  sinks_config JSONB NOT NULL,
  container_id TEXT,
  config_path TEXT,
  exposed_ports JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  status TEXT DEFAULT 'created',
  error_message TEXT,
  active BOOLEAN DEFAULT true,
  deleted BOOLEAN DEFAULT false
);

-- Pipeline metrics table
CREATE TABLE pipeline_metrics (
  id SERIAL PRIMARY KEY,
  pipeline_id UUID NOT NULL,
  metric_type VARCHAR(50) NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  metric_value DECIMAL(15,4),
  unit VARCHAR(20),
  collected_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

## 🛠️ Development

### Cấu trúc thư mục

```
demo_VDT/
├── backend/
│   ├── src/
│   │   ├── configs/          # Database, logger config
│   │   ├── controllers/       # API controllers
│   │   ├── middleware/        # Express middleware
│   │   ├── repositories/      # Database operations
│   │   ├── routes/           # API routes
│   │   ├── services/         # Business logic
│   │   ├── templates/        # Vector YAML templates
│   │   └── tests/           # Test files
│   ├── migrations/           # Database migrations
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API services
│   │   ├── store/           # Zustand state
│   │   ├── types/           # TypeScript types
│   │   └── utils/           # Utility functions
│   └── Dockerfile
├── runtime/
│   ├── configs/             # Generated Vector configs
│   └── logs/               # Application logs
└── docker-compose.yml
```

### Development Commands

```bash
# Backend development
cd backend
npm install
npm start

# Frontend development
cd frontend
npm install
npm start

# Database operations
docker exec vdt_pg psql -U vector -d pipelines -c "SELECT * FROM custom_pipelines;"

# View logs
docker-compose logs -f api
docker-compose logs -f frontend
```

### Testing

```bash
# Backend tests
cd backend
npm run test:db
npm run test:logger
npm run test:realtime-counter

# Frontend build test
cd frontend
npm run build
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Frontend build errors (TS1208)
```bash
# Fix: Add export statements to TypeScript files
echo "export {}" >> src/components/ui/UIElements.tsx
```

#### 2. Database connection issues
```bash
# Restart PostgreSQL container
docker-compose restart postgres

# Check database logs
docker-compose logs postgres
```

#### 3. Vector container issues
```bash
# Check Vector container logs
docker logs <vector_container_name>

# Restart Vector container
docker restart <vector_container_name>
```

#### 4. Metrics collection issues
```bash
# Check if Vector API is accessible
curl http://localhost:8686/health

# Manual metrics collection
curl -X POST http://localhost:3000/api/custom-monitoring/collect/<pipeline_id>
```

### Log Locations

- **Application logs:** `runtime/logs/application-YYYY-MM-DD.log`
- **Error logs:** `runtime/logs/error-YYYY-MM-DD.log`
- **Vector configs:** `runtime/configs/vector_*.yaml`

### Performance Tuning

1. **Database optimization:**
   ```sql
   CREATE INDEX idx_pipeline_metrics_pipeline_time ON pipeline_metrics(pipeline_id, collected_at DESC);
   ```

2. **Metrics collection interval:**
   - High frequency: 10-30 seconds
   - Standard: 60 seconds
   - Low frequency: 300-900 seconds

3. **Memory usage:**
   - Monitor container memory usage
   - Adjust Vector buffer settings if needed

## 📝 License

This project is licensed under the ISC License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For issues and questions:
- Create an issue in the GitHub repository
- Check the troubleshooting section
- Review the logs in `runtime/logs/`

---

**Vector Pipeline System** - A comprehensive data pipeline management platform built with Vector, Node.js, and React.