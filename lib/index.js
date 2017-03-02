const assert = require('assert-plus');
const KMS = require('./kms');
const fs = require('mz/fs');
const utils = require('./file.utils');

const create = (client) => {
    const kms = KMS.create(client);
    const KMS_KEY_ID = 'KMS_KEY_ID';
    const KMS_DATA_KEY = 'KMS_DATA_KEY';

    const remove = (array, index) => array.splice(index, 1);

    const contentToArray = (content) => {
        const lines = content.trim().split('\n').map(line => {
            const parts = line.split('=');
            assert.bool(parts.length == 2, 'Invalid line in file. All lines must be of the form A=B');
            return {key: parts[0].trim(), value: parts[1].trim()};
        });
        return lines;
    };

    const arrayToContent = (lines) => {
        return lines.map(pair => `${pair.key} = ${pair.value}`).join('\n');
    };

    const init = async(keyId, file) => {
        const dataKeyResp = await kms.generateDataKey(keyId);
        const dataKey = dataKeyResp.CiphertextBlob.toString('base64');
        const content = await utils.getFileContent(file).catch(err => '');

        const pairs = contentToArray(content);
        // for quick access
        const pairMap = pairs.reduce((acc, pair) => {
            acc[pair.key] = pair;
            return acc;
        }, {});

        if (pairMap[KMS_KEY_ID]) remove(pairs, pairs.indexOf(pairMap[KMS_KEY_ID]));
        if (pairMap[KMS_DATA_KEY]) remove(pairs, pairs.indexOf(pairMap[KMS_DATA_KEY]));

        const initPairs = [{key:KMS_KEY_ID, value:keyId}, {key:KMS_DATA_KEY, value:dataKey}];
        const newPairs = initPairs.concat(pairs);
        const newContent = arrayToContent(newPairs);
        await fs.writeFile(file, newContent, 'utf8');
    };

    return {
        contentToArray,
        arrayToContent,
        init
    };
};

module.exports = {
    KMSEnv: {
        create
    }
};