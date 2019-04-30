var namehash = require('eth-ens-namehash');
const sha3 = require('web3-utils').sha3;
var Promise = require('bluebird');
const { evm } = require('@ensdomains/test-utils');

const toBN = require('web3-utils').toBN;

const DAYS = 24 * 60 * 60;
const SALT = sha3('foo');

async function registerOldNames(names, account, dhr, ens) {
    var hashes = names.map(sha3);
    var value = toBN(10000000000000000);
    var bidHashes = await Promise.map(hashes, (hash) => dhr.shaBid(hash, account, value, SALT));
    await dhr.startAuctions(hashes);
    await Promise.map(bidHashes, (h) => dhr.newBid(h, {value: value, from: account}));
    await evm.advanceTime(3 * DAYS + 1);
    await Promise.map(hashes, (hash) => dhr.unsealBid(hash, value, SALT, {from: account}));
    await evm.advanceTime(2 * DAYS + 1);
    await Promise.map(hashes, (hash) => dhr.finalizeAuction(hash, {from: account}));
    for(var name of names) {
        assert.equal(await ens.owner(namehash.hash(name + '.eth')), account);
    }
}

module.exports = {
    registerOldNames: registerOldNames
};