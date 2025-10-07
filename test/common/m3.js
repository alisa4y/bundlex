module.exports = {
  sendMessage: (options = {}) => __fetchApi("api/A/sendMessage", options),
}
