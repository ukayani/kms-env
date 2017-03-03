#!/usr/bin/env node --harmony

'use strict';
const pkg = require('../package.json');
const path = require('path');
const assert = require('assert-plus');
const program = require('commander');
const chalk = require('chalk');
const AWS = require('aws-sdk');
const KMSEnv = require('../lib').KMSEnv;

const showHelp = () => {
  program.outputHelp(chalk.blue);
};

function exitIfFailed(fn) {
  const args = Array.prototype.slice.call(arguments, 1);
  try {
    return fn.apply(null, args);
  } catch (err) {
    console.error(chalk.red(err.message));
    showHelp();
    process.exit(1);
  }
}

const exitOnFailedPromise = (promise) => promise.catch(err => {
  console.error(chalk.red(err.message));
  showHelp();
  process.exit(1);
});

const getOptions = (options) => {
  const accessKey = options.accessKeyId;
  const secretKey = options.secretAccessKey;
  const region = options.region;

  return {
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
    region
  };
};

const createClient = (program) => {
  const options = exitIfFailed(getOptions, program);

  const config = {
    apiVersion: '2014-11-01',
    accessKeyId: options.accessKeyId,
    secretAccessKey: options.secretAccessKey,
    region: options.region
  };
  const client = new AWS.KMS(config);
  return KMSEnv.create(client);
};

const runInit = async(client, keyId, file) => {

  assert.string(keyId, 'Must provide keyId');
  assert.string(file, 'Must provide file');

  await client.init(keyId, path.resolve(file));
};

const runAdd = async(client, file, entries) => {
  assert.string(file, 'Must provide file');
  assert.bool(Array.isArray(entries), 'Must provide entries to encrypt');

  await client.add(path.resolve(file), entries);
};

const runDecrypt = async(client) => {
  const output = await client.decrypt(process.env);
  console.log(output);
};

const runShow = async(client, file) => {
  assert.string(file, 'Must provide file to show');
  const output = await client.show(path.resolve(file));
  console.log(output);
};

program
  .version(pkg.version)
  .option('-k, --access-key-id <id>', 'AWS Access key ID. Env: $AWS_ACCESS_KEY_ID')
  .option('-s, --secret-access-key <secret>', 'AWS Secret Access Key. Env: $AWS_SECRET_ACCESS_KEY')
  .option('-r, --region <region>', 'AWS Region. Env: $AWS_DEFAULT_REGION');

program
  .command('init [keyId] [file]')
  .description('Initialize an environment variable file with provided CMK Id')
  .action((keyId, file) => {
    const client = createClient(program);
    exitOnFailedPromise(runInit(client, keyId, file));
  });

program
  .command('add [file] [entries...]')
  .description('Adds environment variable to file after encrypting the value')
  .action((file, entries) => {
    const client = createClient(program);
    exitOnFailedPromise(runAdd(client, file, entries));
  });

program
  .command('decrypt')
  .description(
    'Decrypts secure environment variables and generates a bash export for each. ' + 'Can be used with bash eval command to do in place decryption of env variables')
  .action(() => {
    const client = createClient(program);
    exitOnFailedPromise(runDecrypt(client));
  });

program
  .command('show [file]')
  .description('Show the contents of the env file decrypting all secure vars. Warning: Only use for debugging!')
  .action(file => {
    const client = createClient(program);
    exitOnFailedPromise(runShow(client, file));
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  showHelp();
}
