'use strict';
const assert = require('assert-plus');
const crypto = require('crypto');

const create = (kms) => {

  const encrypt = (keyId, data) => {
    assert.string(keyId, 'Must provide CMK ID');
    assert.string(data, 'Must provide data to encrypt');

    return kms.encrypt({
      KeyId: keyId,
      Plaintext: new Buffer(data, 'utf8')
    })
              .promise()
              .then(res => res.CiphertextBlob);
  };

  const decrypt = (data) => {
    assert.string(data, 'Must provide data to decrypt');
    return kms.decrypt({CiphertextBlob: new Buffer(data, 'base64')})
              .promise()
              .then(res => res.Plaintext);
  };

  const algorithm = 'aes-256-ctr';

  const encryptWithPassword = (data, password) => {
    assert.buffer(password, 'Must provide password');
    assert.string(data, 'Must provide data to encrypt');

    const cipher = crypto.createCipher(algorithm, password);
    let crypted = cipher.update(data, 'utf8', 'hex');
    crypted += cipher.final('hex');
    return crypted;
  };

  const decryptWithPassword = (data, password) => {
    assert.buffer(password, 'Must provide password');
    assert.string(data, 'Must provide encrypted data for decryption');

    const decipher = crypto.createDecipher(algorithm, password);
    let dec = decipher.update(data, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  };

  const generateDataKey = (keyId, options) => {
    options = options || {};
    const keyspec = options.keySpec || 'AES_256';
    const params = {
      KeyId: keyId,
      KeySpec: keyspec
    };

    return kms.generateDataKey(params).promise();
  };

  return {
    encrypt,
    decrypt,
    encryptWithPassword,
    decryptWithPassword,
    generateDataKey
  };
};

module.exports = {
  create
};
