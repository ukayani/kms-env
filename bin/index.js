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

const bold = chalk.bold.white;

const getParams = (options) => {
    const accessKey = options.accessKeyId;
    const secretKey = options.secretAccessKey;
    const region = options.region;

    // assert.string(service, 'service is required');
    // assert.string(cluster, 'cluster is required');
    // assert.string(image, 'image is required');

    return {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
        region
    };
};

const run = async(params) => {

    const config = {
        apiVersion: '2014-11-01',
        accessKeyId: params.accessKeyId,
        secretAccessKey: params.secretAccessKey,
        region: params.region
    };
    const client = new AWS.KMS(config);

    const kmsEnv = KMSEnv.create(client);
    await kmsEnv.init('alias/ecs', path.resolve('./test.env'));
};

program
    .version(pkg.version)
    .option('-k, --access-key-id <id>', 'AWS Access key ID. Env: $AWS_ACCESS_KEY_ID')
    .option('-s, --secret-access-key <secret>', 'AWS Secret Access Key. Env: $AWS_SECRET_ACCESS_KEY')
    .option('-r, --region <region>', 'AWS Region. Env: $AWS_DEFAULT_REGION');

program
    .command('encrypt [key] [data]')
    .description('Encrypt environment variables and add to a file')
    .action((key, data) => {
        const params = exitIfFailed(getParams, program);
        run(params);
    });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
    showHelp();
}