const assert = require('assert-plus');
const KMS = require('./kms');

const securePattern = /^secure:/;
const formatSecure = (value) => `secure:${value}`;
const parseSecure = (value) => value.replace(securePattern, '');
const isSecure = (value) => securePattern.test(value);

const create = (client, fs) => {
  const kms = KMS.create(client);
  const KMS_DATA_KEY = 'KMS_DATA_KEY';

  const remove = (array, index) => array.splice(index, 1);

  const contentToArray = (content) => {
    return content.trim().split('\n')
                  .filter(line => line.length > 0)
                  .map(line => {
                    const parts = line.split('=');
                    assert.bool(parts.length == 2, 'Invalid line in file. All lines must be of the form A=B');
                    return {
                      key: parts[0].trim(),
                      value: parts[1].trim()
                    };
                  });
  };

  const arrayToContent = (lines) => {
    return lines.map(pair => `${pair.key} = ${pair.value}`).join('\n');
  };

  const toMap = (pairs) => pairs.reduce((acc, pair) => {
    acc[pair.key] = pair;
    return acc;
  }, {});

  const init = (keyId, file) => {
    return kms.generateDataKey(keyId)
       .then(dataKeyResp => dataKeyResp.CiphertextBlob.toString('base64'))
       .then(dataKey => fs.read(file).then(content => [dataKey, content]))
       .then(params => {
         const [dataKey, content] = params;
         const pairs = contentToArray(content);
         // for quick access
         const pairMap = toMap(pairs);
         if (pairMap[KMS_DATA_KEY]) {
           remove(pairs, pairs.indexOf(pairMap[KMS_DATA_KEY]));
         }

         const initPairs = [{
           key: KMS_DATA_KEY,
           value: dataKey
         }];
         const newPairs = initPairs.concat(pairs);
         return fs.write(file, arrayToContent(newPairs));
       });
  };

  const add = (file, entries) => {

    const parsedEntries = entries.map(e => {
      const parts = e.split('=');
      assert.bool(parts.length == 2, 'Invalid key value pair provided. Must be in format A=B');

      const key = parts[0].trim();
      const value = parts[1].trim();
      return {
        key,
        value
      };
    });

    return fs.read(file)
      .then(content => {
        const pairs = contentToArray(content);
        const pairMap = toMap(pairs);

        const encDataKey = pairMap[KMS_DATA_KEY].value;
        assert.string(encDataKey, 'File must contain KMS_DATA_KEY. Run init.');
        return kms.decrypt(encDataKey).then(dataKey => [pairs, pairMap, dataKey])
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

        const encDataKey = pairMap[KMS_DATA_KEY].value;
        assert.string(encDataKey, 'File must contain KMS_DATA_KEY. Run init.');

        return kms.decrypt(encDataKey).then(dataKey => [pairs, dataKey]);
      })
      .then(params => {
        const [pairs, dataKey] = params;
        const decryptValue = (value) => isSecure(value) ? kms.decryptWithPassword(parseSecure(value), dataKey) : value;

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
      return '';
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
          return `export ${pair.key}=${pair.value};echo "Decrypted ${pair.key}";`;
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
