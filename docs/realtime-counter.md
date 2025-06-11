# Real-time Log Counter

Tính năng theo dõi số lượng log real-time cho các pipeline.

## Chức năng

- **Real-time counting**: Đếm số log đi vào qua HTTP và File sources
- **Live monitoring**: Cập nhật số đếm mỗi 5 giây (có thể tùy chỉnh)
- **API endpoints**: Cung cấp APIs để lấy số đếm real-time
- **Force update**: Có thể cập nhật số đếm ngay lập tức

## API Endpoints

### 1. Bắt đầu Monitoring
```bash
POST /api/realtime-counter/start
Content-Type: application/json

{
  "interval_ms": 5000  # Tùy chọn, mặc định 5000ms
}
```

### 2. Dừng Monitoring
```bash
POST /api/realtime-counter/stop
```

### 3. Lấy số đếm của một Pipeline
```bash
GET /api/realtime-counter/counts/:pipelineId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "pipeline_id": "uuid",
    "sources": {
      "http_source": {
        "type": "http",
        "total_count": 150,
        "new_count": 5,
        "last_updated": "2025-06-11T10:30:00Z"
      },
      "file_source": {
        "type": "file", 
        "total_count": 75,
        "new_count": 2,
        "last_updated": "2025-06-11T10:30:00Z"
      }
    }
  }
}
```

### 4. Lấy tóm tắt readable
```bash
GET /api/realtime-counter/summary/:pipelineId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "pipeline_id": "uuid",
    "monitoring_active": true,
    "sources": {
      "http_source": {
        "source_type": "http",
        "total_logs_received": 150,
        "new_logs_since_last_check": 5,
        "message": "5 new log(s) received via HTTP"
      }
    }
  }
}
```

### 5. Cập nhật ngay lập tức
```bash
POST /api/realtime-counter/update/:pipelineId
```

### 6. Lấy trạng thái monitoring
```bash
GET /api/realtime-counter/status
```

## Cách sử dụng

### 1. Tạo Pipeline với HTTP và File sources

```bash
POST /api/custom-pipelines
Content-Type: application/json

{
  "name": "Test Pipeline",
  "sources": {
    "http_logs": {
      "type": "http",
      "listen_port": 8080
    },
    "file_logs": {
      "type": "file",
      "include": ["/var/log/*.log"]
    }
  },
  "transforms": {
    "http_logs": ["parse"],
    "file_logs": ["parse"]
  },
  "sinks": {
    "http_logs": ["console"],
    "file_logs": ["console"]
  }
}
```

### 2. Bắt đầu monitoring

```bash
POST /api/realtime-counter/start
Content-Type: application/json

{
  "interval_ms": 3000  # Cập nhật mỗi 3 giây
}
```

### 3. Gửi log qua HTTP

```bash
curl -X POST http://localhost:8080 \
  -H "Content-Type: application/json" \
  -d '{"message": "Test log", "level": "INFO"}'
```

### 4. Kiểm tra số đếm

```bash
GET /api/realtime-counter/summary/{pipeline-id}
```

**Kết quả sẽ hiển thị:**
```json
{
  "sources": {
    "http_logs": {
      "message": "1 new log(s) received via HTTP",
      "total_logs_received": 1
    }
  }
}
```

## Test Script

Chạy test tự động:

```bash
npm run test:realtime-counter
```

Script này sẽ:
1. Tạo pipeline test với HTTP (port 8080) và File sources
2. Bắt đầu real-time monitoring
3. Gửi 5 log qua HTTP và 5 log qua file
4. Kiểm tra số đếm
5. Gửi thêm log và kiểm tra lại
6. Dọn dẹp resources

## Cách hoạt động

1. **Vector Metrics**: Service lấy metrics từ Vector API (port 8686)
2. **Prometheus Format**: Parse metrics format Prometheus từ Vector
3. **Diff Calculation**: So sánh với lần đo trước để tính số log mới
4. **Component ID**: Sử dụng component_id để phân biệt sources
5. **Real-time Updates**: Cập nhật định kỳ theo interval được set

## Vector Configuration

Service tự động thêm `component_id` cho mỗi source:

```yaml
sources:
  http_logs:
    type: http_server
    address: 0.0.0.0:8080
    component_id: "http_logs"  # Tự động thêm
    
  file_logs:
    type: file
    include: ["/var/log/*.log"]
    component_id: "file_logs"  # Tự động thêm
```

## Metrics được theo dõi

- `vector_component_received_events_total{component_id="source_name"}`: Tổng events nhận được
- `vector_component_received_bytes_total{component_id="source_name"}`: Tổng bytes nhận được

## Troubleshooting

### Không nhận được số đếm

1. Kiểm tra pipeline đang chạy:
   ```bash
   GET /api/manage/status/:pipelineId
   ```

2. Kiểm tra Vector API có accessible:
   ```bash
   docker exec <container_id> curl http://localhost:8686/metrics
   ```

3. Kiểm tra monitoring đang chạy:
   ```bash
   GET /api/realtime-counter/status
   ```

### Số đếm không chính xác

1. Force update ngay lập tức:
   ```bash
   POST /api/realtime-counter/update/:pipelineId
   ```

2. Restart monitoring:
   ```bash
   POST /api/realtime-counter/stop
   POST /api/realtime-counter/start
   ```
