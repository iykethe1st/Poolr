import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

@Controller('users')
export class KycWidgetController {
  constructor(private readonly config: ConfigService) {}

  @Get('kyc/widget')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiExcludeEndpoint()
  getWidget(@Query('user_id') userId: string): string {
    const appId = this.config.get<string>('DOJAH_APP_ID', '');
    // Sanitise to prevent XSS — only allow alphanumeric + hyphen (UUID chars)
    const safeUserId = (userId ?? '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 64);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <title>Identity Verification</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif;
           background: #f0f9f4; display: flex; flex-direction: column;
           align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
    .card { background: #fff; border-radius: 16px; padding: 32px 24px;
            text-align: center; max-width: 360px; width: 100%;
            box-shadow: 0 4px 24px rgba(21,94,62,0.08); }
    .logo { font-size: 28px; font-weight: 800; color: #155e3e; margin-bottom: 24px; }
    .spinner { width: 44px; height: 44px; border: 3px solid #d1e8da;
               border-top-color: #155e3e; border-radius: 50%;
               animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    p { color: #5a7566; font-size: 15px; line-height: 1.5; margin: 0; }
    .error { color: #b91c1c; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Poolr</div>
    <div class="spinner" id="spinner"></div>
    <p id="msg">Loading identity verification…</p>
  </div>

  <script src="https://widget.dojah.io/widget.js"></script>
  <script>
    function showError(msg) {
      document.getElementById('spinner').style.display = 'none';
      var el = document.getElementById('msg');
      el.textContent = msg;
      el.className = 'error';
    }

    if (!window.Connect) {
      showError('Could not load verification widget. Please check your connection and try again.');
    } else {
      try {
        var options = {
          app_id: "${appId}",
          type: "custom",
          config: { debug: false },
          metadata: { user_id: "${safeUserId}" },
          onSuccess: function (data) {
            var refId = (data && data.reference_id) ? data.reference_id : '';
            window.location.href = 'poolr://kyc-callback?status=success&reference_id=' + encodeURIComponent(refId);
          },
          onError: function () {
            window.location.href = 'poolr://kyc-callback?status=error';
          },
          onClose: function () {
            window.location.href = 'poolr://kyc-callback?status=closed';
          }
        };
        var connect = new Connect(options);
        connect.setup();
        connect.open();
      } catch (e) {
        showError('Verification could not start. Please try again.');
      }
    }
  </script>
</body>
</html>`;
  }
}
