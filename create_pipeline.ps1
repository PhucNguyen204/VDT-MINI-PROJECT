# PowerShell script to create a dual-source pipeline
$apiUrl = "http://localhost:3000/api/custom-pipelines"

# Prepare the data structure for the custom pipeline API
$pipelineData = @{
    name = "dual-source-pipeline"
    sources = @{
        file_source = @{
            type = "file"
            include = @("D:/demo_VDT/runtime/logs/*.log")
        }
        http_source = @{
            type = "http"
            listen_port = 8090
        }
    }
    transforms = @{
        file_source = @("parse", "enrich")
        http_source = @("parse", "enrich")
    }
    sinks = @{
        file_source = @("s3")
        http_source = @("s3")
    }
} | ConvertTo-Json -Depth 10

# Display the JSON data being sent
Write-Host "Sending JSON data:"
Write-Host $pipelineData -ForegroundColor Green

# Make the API call
try {
    $response = Invoke-RestMethod -Uri $apiUrl -Method POST -Body $pipelineData -ContentType "application/json"
    Write-Host "Pipeline created successfully!" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 10) -ForegroundColor Yellow
} catch {
    Write-Host "Error creating pipeline:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.Exception.Response) {
        $responseStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($responseStream)
        $responseContent = $reader.ReadToEnd()
        Write-Host "Response content: $responseContent" -ForegroundColor Red
    }
}
