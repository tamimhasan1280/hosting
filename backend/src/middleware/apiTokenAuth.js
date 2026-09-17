const apiTokenService = require('../services/apiTokenService');

/**
 * Middleware to authenticate requests via Bearer API Token
 * Extracts token from Authorization header or X-cPanel-Token header
 * Attaches req.apiToken and req.cpanelUser upon success
 */
function apiTokenAuth(requiredScope = null) {
  return (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const tokenHeader = req.headers['x-cpanel-token'];
    const rawToken = authHeader || tokenHeader;

    if (!rawToken) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Missing API token in Authorization header or X-cPanel-Token header.'
      });
    }

    const authResult = apiTokenService.authenticateToken(rawToken, requiredScope);

    if (!authResult.authenticated) {
      const statusCode = authResult.forbidden ? 403 : 401;
      return res.status(statusCode).json({
        success: false,
        error: authResult.error
      });
    }

    // Attach verified identity to request
    req.cpanelUser = authResult.user;
    req.apiToken = {
      id: authResult.tokenId,
      name: authResult.tokenName,
      prefix: authResult.prefix,
      scopes: authResult.scopes
    };

    next();
  };
}

module.exports = { apiTokenAuth };
