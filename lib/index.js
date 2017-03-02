const assert = require('assert-plus');
const KMS = require('./kms');
const fs = require('mz/fs');
const utils = require('./file.utils');

const securePattern = /^secure:/;
const formatSecure = (value) => `secure:${value}`;
const parseSecure = (value) => value.replace(securePattern, '');
const isSecure = (value) => securePattern.test(value);

const create = (client) => {
    const kms = KMS.create(client);
    const KMS_DATA_KEY = 'KMS_DATA_KEY';

    const remove = (array, index) => array.splice(index, 1);

    const contentToArray = (content) => {
        return content.trim().split('\n')
                      .filter(line => line.length > 0)
                      .map(line => {
                            const parts = line.split('=');
                            assert.bool(parts.length == 2, 'Invalid line in file. All lines must be of the form A=B');
                            return {key: parts[0].trim(), value: parts[1].trim()};
                      });
    };

    const arrayToContent = (lines) => {
        return lines.map(pair => `${pair.key} = ${pair.value}`).join('\n');
    };

    const toMap = (pairs) => pairs.reduce((acc, pair) => {
            acc[pair.key] = pair;
            return acc;
        }, {});

    const init = async(keyId, file) => {
        console.log(keyId, file);
        const dataKeyResp = await kms.generateDataKey(keyId);
        const dataKey = dataKeyResp.CiphertextBlob.toString('base64');
        const content = await utils.getFileContent(file).catch(err => '');

        const pairs = contentToArray(content);
        // for quick access
        const pairMap = toMap(pairs);
        if (pairMap[KMS_DATA_KEY]) remove(pairs, pairs.indexOf(pairMap[KMS_DATA_KEY]));

        const initPairs = [{key:KMS_DATA_KEY, value:dataKey}];
        const newPairs = initPairs.concat(pairs);
        const newContent = arrayToContent(newPairs);
        await fs.writeFile(file, newContent, 'utf8');
    };

    const add = async(pair, file) => {

        const parts = pair.split('=');
        assert.bool(parts.length == 2, 'Invalid key value pair provided. Must be in format A=B');

        const key = parts[0].trim();
        const value = parts[1].trim();

        const content = await utils.getFileContent(file).catch(err => '');
        const pairs = contentToArray(content);
        const pairMap = toMap(pairs);

        const encDataKey = pairMap[KMS_DATA_KEY].value;

        assert.string(encDataKey, 'File must contain KMS_DATA_KEY. Run init.');

        const dataKey = await kms.decrypt(encDataKey);
        const encValue = kms.encryptWithPassword(value, dataKey);

        const prefixedValue = formatSecure(encValue);

        if (pairMap[key]) {
            pairMap[key].value = prefixedValue;
        } else {
            pairs.push({key, value: prefixedValue});
        }

        const newContent = arrayToContent(pairs);
        await fs.writeFile(file, newContent, 'utf8');
    };

    const show = async(file) => {
        assert.string(file, 'Must provide file');

        const content = await utils.getFileContent(file).catch(err => '');
        const pairs = contentToArray(content);
        const pairMap = toMap(pairs);

        const encDataKey = pairMap[KMS_DATA_KEY].value;
        assert.string(encDataKey, 'File must contain KMS_DATA_KEY. Run init.');

        const dataKey = await kms.decrypt(encDataKey);

        const decryptValue = (value) => isSecure(value) ? kms.decryptWithPassword(parseSecure(value), dataKey): value;

        const decryptedPairs = pairs.map(pair => {
            pair.value = decryptValue(pair.value);
            return pair;
        });

        return arrayToContent(decryptedPairs);
    };

    const decrypt = async(env) => {
        assert.object(env, 'Must supply an env object');

        const encDataKey = env[KMS_DATA_KEY];

        if (!encDataKey) return '';

        const dataKey = await kms.decrypt(encDataKey);

        const decrypted = Object.keys(env).filter(key => isSecure(env[key])).map(key => {
            const encValue = parseSecure(env[key]);
            const value = kms.decryptWithPassword(encValue, dataKey);
            return {key, value};
        });

        return decrypted.map(pair => {
            return `export ${pair.key}=${pair.value};echo "Decrypted ${pair.key}";`
        }).join('\n');
    };

    return {
        contentToArray,
        arrayToContent,
        init,
        add,
        show,
        decrypt
    };
};

module.exports = {
    KMSEnv: {
        create
    }
};