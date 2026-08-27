# PowerShell Local Web Server for Bookstore App
# Run this script to start a local static server on http://localhost:8080

$Port = 8080
$RootDirectory = $PSScriptRoot

$MimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".pdf"  = "application/pdf"
    ".ico"  = "image/x-icon"
}

$Listener = New-Object System.Net.HttpListener
$Prefix = "http://localhost:$Port/"
$Listener.Prefixes.Add($Prefix)

try {
    $Listener.Start()
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "  📚 កម្មវិធីមើលសៀវភៅអនឡាញ (Bookstore App) កំពុងដំណើរការ!" -ForegroundColor Green
    Write-Host "  🌐 URL: $Prefix" -ForegroundColor Yellow
    Write-Host "  💡 ចុច Ctrl + C ដើម្បីបិទ Server" -ForegroundColor Gray
    Write-Host "==========================================================" -ForegroundColor Cyan

    # Launch default web browser
    Start-Process $Prefix

    while ($Listener.IsListening) {
        $Context = $Listener.GetContext()
        $Request = $Context.Request
        $Response = $Context.Response

        $RelativePath = $Request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($RelativePath)) {
            $RelativePath = "index.html"
        }

        $FilePath = Join-Path $RootDirectory $RelativePath

        if (Test-Path $FilePath -PathType Leaf) {
            $Ext = [System.IO.Path]::GetExtension($FilePath).ToLower()
            $ContentType = $MimeTypes[$Ext]
            if (-not $ContentType) {
                $ContentType = "application/octet-stream"
            }

            $Response.ContentType = $ContentType
            $Response.Headers.Add("Access-Control-Allow-Origin", "*")
            $Response.StatusCode = 200

            $Bytes = [System.IO.File]::ReadAllBytes($FilePath)
            $Response.ContentLength64 = $Bytes.Length
            $Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
        }
        else {
            $Response.StatusCode = 404
            $ErrorMsg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $Response.OutputStream.Write($ErrorMsg, 0, $ErrorMsg.Length)
        }

        $Response.OutputStream.Close()
    }
}
catch {
    Write-Host "Error starting server: $_" -ForegroundColor Red
}
finally {
    $Listener.Stop()
}
