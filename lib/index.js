const assert = require('assert-plus');
const KMS = require('./kms');

const securePattern = /^secure:/;
const formatSecure = (value) => `secure:${value}`;
const parseSecure = (value) => value.replace(securePattern, '');
const isSecure = (value) => securePattern.test(value);
const envPattern = /^([A-Za-z0-9_]+)=(.*)[\r\n\t]*$/;

const getEnv = (line) => {
  const match = envPattern.exec(line);
  assert.bool(match && match.length > 2, 'Line is not valid environment variable definition');
  return [match[1], match[2]];
};

const create = (client, fs) => {
  const kms = KMS.create(client);
  const KMS_DATA_KEY = 'KMS_DATA_KEY';
  const AWS_REGION = 'AWS_REGION';
  const remove = (array, index) => array.splice(index, 1);

  const contentToArray = (content) => {
    return content.trim().split('\n')
                  .filter(line => line.length > 0)
                  .map(line => {
                    const [key, value] = getEnv(line);
                    return {
                      key: key.trim(),
                      value: value.trim()
                    };
                  });
  };

  const arrayToContent = (lines) => {
    return lines.map(pair => `${pair.key}=${pair.value}`).join('\n');
  };

  const toMap = (pairs) => pairs.reduce((acc, pair) => {
    acc[pair.key] = pair;
    return acc;
  }, {});

  const keyArnPattern = /^arn:aws:kms:([A-Za-z0-9-]+):\d+:key\/([a-z0-9-]+)/g;
  const parseKeyArn = (arn) => {
    const match = keyArnPattern.exec(arn);
    return (match) ? {
      id: match[2],
      region: match[1],
      arn: match[0]
    } : match;
  };

  const init = (keyId, file) => {
    return kms.generateDataKey(keyId)
              .then(dataKeyResp => {
                const region = parseKeyArn(dataKeyResp.KeyId).region;
                return [dataKeyResp.CiphertextBlob.toString('base64'), region];
              })
              .then(params => {
                const [dataKey, region] = params;
                return fs.read(file).then(content => [dataKey, region, content]);
              })
              .then(params => {
                const [dataKey, region, content] = params;
                const pairs = contentToArray(content);
                // for quick access
                const pairMap = toMap(pairs);
                if (pairMap[KMS_DATA_KEY]) {
                  remove(pairs, pairs.indexOf(pairMap[KMS_DATA_KEY]));
                }
                if (pairMap[AWS_REGION]) {
                  remove(pairs, pairs.indexOf(pairMap[AWS_REGION]));
                }

                const initPairs = [{
                  key: KMS_DATA_KEY,
                  value: dataKey
                }, {
                  key: 'AWS_REGION',
                  value: region
                }];
                const newPairs = initPairs.concat(pairs);
                return fs.write(file, arrayToContent(newPairs));
              });
  };

  const add = (file, entries) => {

    const parsedEntries = entries.map(e => {
      const [key, value] = getEnv(e);
      return {
        key: key.trim(),
        value: value.trim()
      };
    });

    return fs.read(file)
             .then(content => {
               const pairs = contentToArray(content);
               const pairMap = toMap(pairs);
               assert.bool(pairMap.hasOwnProperty(KMS_DATA_KEY), 'File must contain KMS_DATA_KEY. Run init or double check filename.');
               const encDataKey = pairMap[KMS_DATA_KEY].value;
               return kms.decrypt(encDataKey).then(dataKey => [pairs, pairMap, dataKey]);
             })
             .then(params => {
               const [pairs, pairMap, dataKey] = params;

               parsedEntries.forEach(entry => {
                 const encValue = kms.encryptWithPassword(entry.value, dataKey);
                 const prefixedValue = formatSecure(encValue);

                 if (pairMap[entry.key]) {
                   pairMap[entry.key].value = prefixedValue;
                 } else {
                   pairs.push({
                     key: entry.key,
                     value: prefixedValue
                   });
                 }
               });
               return fs.write(file, arrayToContent(pairs));
             });
  };

  const show = (file) => {
    assert.string(file, 'Must provide file');

    return fs.read(file)
             .then(content => {
               const pairs = contentToArray(content);
               const pairMap = toMap(pairs);

               assert.bool(pairMap.hasOwnProperty(KMS_DATA_KEY), 'File must contain KMS_DATA_KEY. Run init or double check filename.');
               const encDataKey = pairMap[KMS_DATA_KEY].value;

               return kms.decrypt(encDataKey).then(dataKey => [pairs, dataKey]);
             })
             .then(params => {
               const [pairs, dataKey] = params;
               const decryptValue = (value) => isSecure(value) ? kms.decryptWithPassword(parseSecure(value),
                 dataKey) : value;

               const decryptedPairs = pairs.map(pair => {
                 pair.value = decryptValue(pair.value);
                 return pair;
               });

               return arrayToContent(decryptedPairs);
             });
  };

  const decrypt = (env) => {
    assert.object(env, 'Must supply an env object');

    const encDataKey = env[KMS_DATA_KEY];

    if (!encDataKey) {
      return Promise.resolve('');
    }

    return kms.decrypt(encDataKey)
              .then(dataKey => {

                const decrypted = Object.keys(env).filter(key => isSecure(env[key])).map(key => {
                  const encValue = parseSecure(env[key]);
                  const value = kms.decryptWithPassword(encValue, dataKey);
                  return {
                    key,
                    value
                  };
                });

                return decrypted.map(pair => {
                  return `export ${pair.key}="${pair.value}";echo "Decrypted ${pair.key}";`;
                }).join('\n');
              });
  };

  return {
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
