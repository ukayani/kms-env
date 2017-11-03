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

  const ALGORITHM = 'aes-256-ctr';
  // For AES, this is 16
  const IV_LENGTH = 16;
  const DELIMITER = '$';

  const encryptWithPassword = (data, password) => {
    assert.buffer(password, 'Must provide password');
    assert.string(data, 'Must provide data to encrypt');

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, password, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + DELIMITER + encrypted;
  };

  const decryptWithPassword = (data, password) => {
    assert.buffer(password, 'Must provide password');
    assert.string(data, 'Must provide encrypted data for decryption');

    const hasIV = data.includes(DELIMITER);

    let decipher;
    if (hasIV) {
      const parts = data.split(DELIMITER);
      const iv = new Buffer(parts.shift(), 'hex');
      let encryptedPart = new Buffer(parts.join(DELIMITER), 'hex');
      decipher = crypto.createDecipheriv(ALGORITHM, password, iv);
      let dec = decipher.update(encryptedPart, 'hex', 'utf8');
      dec += decipher.final('utf8');
      return dec;
    } else {
      // deprecated
      decipher = crypto.createDecipher(ALGORITHM, password);
      let dec = decipher.update(data, 'hex', 'utf8');
      dec += decipher.final('utf8');
      return dec;
    }
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
