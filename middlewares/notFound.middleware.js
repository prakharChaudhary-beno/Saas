const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    status: 'error',
    statusCode: 404,
    message: 'Route not found'
  });
};

module.exports = notFoundHandler;