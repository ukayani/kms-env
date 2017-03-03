'use strict';
const fs = require('mz/fs');

const read = (file) => fs.readFile(file, 'utf-8').catch(() => '');
const write = (file, content) => fs.writeFile(file, content, 'utf8');

module.exports = {
  read,
  write
};
