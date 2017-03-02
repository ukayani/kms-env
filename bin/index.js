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

const bold = chalk.bold.white;

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

const runInit = async(keyId, file, options) => {

    assert.string(keyId, 'Must provide keyId');
    assert.string(file, 'Must provide file');

    const config = {
        apiVersion: '2014-11-01',
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
        region: options.region
    };
    const client = new AWS.KMS(config);

    const kmsEnv = KMSEnv.create(client);
    await kmsEnv.init(keyId, path.resolve(file));
};

const runAdd = async(entry, file, options) => {
    assert.string(file, 'Must provide file');
    assert.string(entry, 'Must provide pair');

    const config = {
        apiVersion: '2014-11-01',
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
        region: options.region
    };
    const client = new AWS.KMS(config);

    const kmsEnv = KMSEnv.create(client);
    await kmsEnv.add(entry, path.resolve(file));
};

const runDecrypt = async(options) => {
    const config = {
        apiVersion: '2014-11-01',
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
        region: options.region
    };
    const client = new AWS.KMS(config);

    const kmsEnv = KMSEnv.create(client);
    const output = await kmsEnv.decrypt(process.env);
    console.log(output);
};

const runShow = async(file, options) => {
    assert.string(file, 'Must provide file to show');
    const config = {
        apiVersion: '2014-11-01',
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
        region: options.region
    };
    const client = new AWS.KMS(config);

    const kmsEnv = KMSEnv.create(client);
    const output = await kmsEnv.show(path.resolve(file));
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
        const options = exitIfFailed(getOptions, program);
        exitOnFailedPromise(runInit(keyId, file, options));
    });

program
    .command('add [entry] [file]')
    .description('Adds environment variable to file after encrypting the value')
    .action((entry, file) => {
        const options = exitIfFailed(getOptions, program);
        exitOnFailedPromise(runAdd(entry, file, options));
    });

program
    .command('decrypt')
    .description('Decrypts secure environment variables and generates a bash export for each. ' +
        'Can be used with bash eval command to do in place decryption of env variables')
    .action(() => {
        const options = exitIfFailed(getOptions, program);
        exitOnFailedPromise(runDecrypt(options));
    });

program
    .command('show [file]')
    .description('Show the contents of the env file decrypting all secure vars. Warning: Only use for debugging!')
    .action(file => {
        const options = exitIfFailed(getOptions, program);
        exitOnFailedPromise(runShow(file, options));
    });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
    showHelp();
}