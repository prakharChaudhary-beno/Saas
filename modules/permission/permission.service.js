
const Permission = require("./permission.model");

exports.getPermissions = async () => {
  return await Permission.find({}, "name slug module").sort({ module: 1 });
};