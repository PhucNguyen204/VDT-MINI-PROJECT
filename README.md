# Vector Pipeline System - Quick Start & API Guide

## 1. Quản lý container & build hệ thống

```powershell
# Xóa toàn bộ container
docker-compose down

# Build lại image
docker-compose build

# Chạy lại hệ thống (build mới)
docker-compose up -d --build
```

---

## 2. Tạo pipeline

### a. Pipeline HTTP (push_http)
```powershell
$body = @{
    name = "ytyty"
    mode = "push_http"
    listen_port = 8087
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/api/multi-pipelines" -Method POST -Body $body -ContentType "application/json"
```
**Đẩy log vào pipeline HTTP:**
```powershell
Invoke-RestMethod -Uri "http://localhost:8085" -Method Post -Body "Log test $(Get-Date)" -ContentType "text/plain"
```

### b. Pipeline File
```powershell
$body = @{
    name = "file-pipeline-1"
    mode = "file"
    include = @("/runtime/logs/**/*.log")
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/api/multi-pipelines" -Method POST -Body $body -ContentType "application/json"
```
**Đẩy log vào file:**
```powershell
Add-Content -Path "d:\demo_VDT\runtime\logs\test.log" -Value "Log test $(Get-Date)"
```

### c. Pipeline Docker Logs
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/multi-pipelines" -Method Post -ContentType "application/json" -Body '{"name":"vdt_pg","mode":"docker_logs"}'
```
**Đẩy log vào container:**
```powershell
docker exec my_app_container sh -c "echo 'Log test $(date)' 1>&2"
```

---

## 3. Quản lý pipeline

### Lấy danh sách pipeline
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/multi-pipelines" -Method Get
```

### Lấy chi tiết pipeline
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/multi-pipelines/<pipeline_id>" -Method Get
```

### Stop pipeline
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/pipeline-management/stop/<pipeline_id>" -Method Post
```

### Restart pipeline
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/pipeline-management/restart/<pipeline_id>" -Method Post
```

### Stop all pipelines
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/pipeline-management/stop-all" -Method Post
```

### Lấy pipeline đang hoạt động
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/pipeline-management/active" -Method Get
```

### Lấy trạng thái pipeline
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/pipeline-management/status/<pipeline_id>" -Method Get
```

---

## 4. Monitoring

### Thu thập metrics cho một pipeline
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/monitoring/collect/<pipeline_id>" -Method Post
```

### Thu thập metrics cho tất cả pipeline
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/monitoring/collect-all" -Method Post
```

### Lấy metrics lịch sử của một pipeline
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/monitoring/metrics/<pipeline_id>?timeRange=1%20hour&types=health,throughput" -Method Get
```

### Bắt đầu tự động thu thập metrics (interval 30s)
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/monitoring/scheduler/start" -Method Post -ContentType "application/json" -Body '{"intervalSeconds":30}'
```

### Dừng tự động thu thập metrics
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/monitoring/scheduler/stop" -Method Post
```

### Lấy trạng thái scheduler
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/monitoring/scheduler/status" -Method Get
```

### Cập nhật khoảng thời gian thu thập metrics (ví dụ 60s)
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/monitoring/scheduler/interval" -Method Post -ContentType "application/json" -Body '{"intervalSeconds":60}'
```

### Lấy dashboard metrics cho một pipeline
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/monitoring/dashboard/<pipeline_id>" -Method Get
```

---

## 5. Kiểm tra database sau mỗi thao tác

### Đếm số metrics của một pipeline
```powershell
docker exec vdt_pg psql -U vector -d pipelines -c "SELECT COUNT(*) FROM pipeline_metrics WHERE pipeline_id = '<pipeline_id>';"
```

### Xem 10 metrics mới nhất của một pipeline
```powershell
docker exec vdt_pg psql -U vector -d pipelines -c "SELECT * FROM pipeline_metrics WHERE pipeline_id = '<pipeline_id>' ORDER BY collected_at DESC LIMIT 10;"
```

### Đếm số pipeline đang active
```powershell
docker exec vdt_pg psql -U vector -d pipelines -c "SELECT COUNT(*) FROM pipelines WHERE active = true AND deleted = false;"
```

---

docker exec vdt_pg psql -U vector -d pipelines -c "SELECT id, name, active, deleted, stopped_at FROM pipelines ORDER BY created_at DESC;"

docker exec vdt_pg psql -U vector -d pipelines -c "SELECT * FROM pipelines ORDER BY created_at DESC LIMIT 10;"

docker exec vdt_pg psql -U vector -d pipelines -c "SELECT COUNT(*) FROM pipelines WHERE active = true AND deleted = false;"

docker exec vdt_pg psql -U vector -d pipelines -c "SELECT id, name, active, deleted, stopped_at FROM pipelines ORDER BY created_at DESC;"

docker exec vdt_pg psql -U vector -d pipelines -c "SELECT * FROM pipelines WHERE id = '<pipeline_id>';"

**Lưu ý:**
- Thay `<pipeline_id>` bằng ID thực tế của pipeline bạn muốn kiểm tra.
- Có thể copy từng lệnh vào PowerShell để thao tác nhanh.
- Nếu cần kiểm tra bảng khác, chỉ cần thay đổi câu SQL trong lệnh `docker exec`.
docker exec vdt_pg psql -U vector -d pipelines -c "TRUNCATE TABLE pipelines RESTART IDENTITY CASCADE; TRUNCATE TABLE pipeline_metrics RESTART IDENTITY CASCADE; TRUNCATE TABLE pipeline_alerts RESTART IDENTITY CASCADE; TRUNCATE TABLE monitoring_config RESTART IDENTITY CASCADE; TRUNCATE TABLE custom_pipelines RESTART IDENTITY CASCADE"


