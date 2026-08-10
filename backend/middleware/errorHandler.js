/**
 * Centralized Error Handler Middleware
 */
function errorHandler(error, _req, res, _next) {
  const status = error.status || 500;
  console.error('[NeuroBridge Engine Error]:', error.message);
  
  res.status(status).json({
    error: status < 500 ? error.message : 'NeuroBridge engine encountered an error processing your request.',
    timestamp: new Date().toISOString()
  });
}

module.exports = errorHandler;
