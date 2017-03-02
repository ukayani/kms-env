'use strict';
const fs = require('mz/fs');
const path = require('path');

const getFileContent = (file) => {
  return fs.readFile(file, 'utf-8').catch(() => {
    throw new Error(`Could not find file ${file}`);
  });
};

module.exports = {
  getFileContent
};
