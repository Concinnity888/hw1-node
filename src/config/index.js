const path = require('path');

const dbFolder = path.resolve(__dirname, '../../db/');
const dbDumpFile = path.resolve(dbFolder, 'dump.json');
const imageFolder = path.resolve(dbFolder, 'imageFolder');

module.exports = {
  PORT: 8080,

  dbFolder,
  imageFolder,
  dbDumpFile,
};
