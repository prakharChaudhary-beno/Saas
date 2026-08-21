const ssoService = require('./auth.sso.service');
const AppError = require('../../../utils/appError');

/**
 * Initiate SSO login by organization ID
 * GET /api/v1/auth/sso/login/:orgId
 */
exports.ssoLoginByOrg = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    
    const { authorizationUrl } = await ssoService.getAuthorizationUrl(orgId);
    
    res.redirect(authorizationUrl);
  } catch (error) {
    next(error);
  }
};

/**
 * Initiate SSO login by email
 * POST /api/v1/auth/sso/login
 * Body: { email: "user@company.com" }
 */
exports.ssoLoginByEmail = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return next(new AppError('Email is required', 400));
    }

    const { authorizationUrl, state, authKitConfig } = await ssoService.getAuthorizationUrlByEmail(email);
    
    // Return URL and AuthKit config for frontend
    res.json({
      success: true,
      authorizationUrl,
      state,
      authKitConfig // Frontend can use this for embedded UI
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check if domain has SSO configured
 * POST /api/v1/auth/sso/check-domain
 * Body: { domain: "company.com" }
 */
exports.checkSSODomain = async (req, res, next) => {
  try {
    const { domain } = req.body;
    
    if (!domain) {
      return next(new AppError('Domain is required', 400));
    }

    const SSOConnection = require('./models/sso-connection.model');
    
    const ssoConnection = await SSOConnection.findOne({
      domain: domain,
      active: true
    });
    
    if (ssoConnection) {
      res.json({
        hasSSO: true,
        config: {
          provider: ssoConnection.provider,
          domain: ssoConnection.domain,
          organization: ssoConnection.connectionId
        }
      });
    } else {
      res.json({
        hasSSO: false
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * SSO Callback handler
 * GET /api/v1/auth/sso/callback?code=...&state=...
 */
exports.ssoCallback = async (req, res, next) => {
  try {
    const { code, state } = req.query;
    
    console.log('🔍 DEBUG - Callback received:', { 
      code: code ? code.substring(0, 20) + '...' : 'MISSING',
      state: state ? state.substring(0, 20) + '...' : 'MISSING',
      fullQuery: req.query 
    });
    
    if (!code || !state) {
      console.log('❌ ERROR - Missing code or state');
      throw new AppError('Missing authorization code or state', 400);
    }

    console.log('🔍 DEBUG - Calling handleCallback...');
    const { token, user, isNewUser } = await ssoService.handleCallback(code, state);
    console.log('✅ SUCCESS - User authenticated:', { email: user.email, isNewUser });
    
    // For popup flow - return HTML that closes popup and saves token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>SSO Authentication Successful</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          .container {
            text-align: center;
            padding: 40px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            backdrop-filter: blur(10px);
          }
          .spinner {
            border: 3px solid rgba(255, 255, 255, 0.3);
            border-top: 3px solid white;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>✅ Authentication Successful!</h2>
          <div class="spinner"></div>
          <p>Logging you in...</p>
        </div>
        <script>
          // Save tokens to localStorage
          localStorage.setItem('sso_token', '${token}');
          localStorage.setItem('token', '${token}');
          localStorage.setItem('userEmail', '${user.email}');
          localStorage.setItem('isNewUser', '${isNewUser}');
          
          // Notify opener window
          if (window.opener) {
            window.opener.postMessage({
              type: 'SSO_SUCCESS',
              token: '${token}',
              email: '${user.email}',
              isNewUser: ${isNewUser}
            }, '${frontendUrl}');
            
            // Close popup after short delay
            setTimeout(() => {
              window.close();
            }, 500);
          } else {
            // Fallback: redirect to frontend
            window.location.href = '${frontendUrl}/auth/sso/callback?token=${token}&isNewUser=${isNewUser}';
          }
        </script>
      </body>
      </html>
    `;
    
    res.send(html);
  } catch (error) {
    // Send error HTML
    const errorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>SSO Authentication Failed</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #f5f5f5;
          }
          .container {
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            max-width: 400px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>❌ Authentication Failed</h2>
          <p style="color: #666;">${error.message || 'An error occurred during authentication'}</p>
          <button onclick="window.close()" style="padding: 10px 20px; cursor: pointer;">Close</button>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'SSO_ERROR',
              error: '${error.message || 'Authentication failed'}'
            }, '*');
            setTimeout(() => window.close(), 2000);
          }
        </script>
      </body>
      </html>
    `;
    
    res.send(errorHtml);
  }
};

/**
 * Configure SSO connection for organization (Admin)
 * POST /api/v1/auth/sso/configure
 * Body: { orgId, connectionId, domain }
 */
exports.configureSSO = async (req, res, next) => {
  try {
    const { orgId, connectionId, domain } = req.body;
    
    if (!orgId || !connectionId) {
      return next(new AppError('orgId and connectionId are required', 400));
    }

    const connection = await ssoService.configureSSOConnection(orgId, connectionId, domain);
    
    res.json({
      success: true,
      message: 'SSO connection configured successfully',
      data: connection
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Disable SSO for organization (Admin)
 * DELETE /api/v1/auth/sso/:orgId
 */
exports.disableSSO = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    
    await ssoService.disableSSOConnection(orgId);
    
    res.json({
      success: true,
      message: 'SSO disabled for organization'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get SSO status for organization
 * GET /api/v1/auth/sso/status/:orgId
 */
exports.getSSOStatus = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    
    const SSOConnection = require('./models/sso-connection.model');
    const connection = await SSOConnection.findOne({ org_id: orgId });
    
    res.json({
      success: true,
      data: {
        enabled: connection?.active || false,
        provider: connection?.provider || null,
        domain: connection?.domain || null
      }
    });
  } catch (error) {
    next(error);
  }
};
