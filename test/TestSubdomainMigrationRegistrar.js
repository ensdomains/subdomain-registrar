const ENS = artifacts.require("ENSRegistry");
const SubdomainRegistrar = artifacts.require("SubdomainRegistrar");
const EthRegistrarSubdomainRegistrar = artifacts.require("EthRegistrarSubdomainRegistrar");
const SubdomainMigrationRegistrar = artifacts.require("SubdomainMigrationRegistrar");
const EthRegistrar = artifacts.require("BaseRegistrarImplementation");
const HashRegistrar = artifacts.require("HashRegistrar");
const TestResolver = artifacts.require("TestResolver");

var namehash = require('eth-ens-namehash');
const sha3 = require('web3-utils').sha3;
var Promise = require('bluebird');
const { evm } = require('@ensdomains/test-utils');

const toBN = require('web3-utils').toBN;

const DAYS = 24 * 60 * 60;
const SALT = sha3('foo');

contract('SubdomainRegistrar', function (accounts) {
    var ens = null;
    var dhr = null;
    var oldRegistrar = null;
    var resolver = null;
    var ethregistrar = null;

    before(async function () {
        oldRegistrar = await SubdomainRegistrar.deployed();
        ens = await ENS.deployed();
        dhr = await HashRegistrar.deployed();
        resolver = await TestResolver.deployed();

        ethregistrar = await EthRegistrar.new(ens.address, dhr.address, '0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae', Math.floor(Date.now() / 1000) * 2)

    });

    async function registerOldNames(names, account) {
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


    it.only('should migrate domain', async function () {
        await registerOldNames(["yolo"], accounts[0]);
        await ens.setSubnodeOwner('0x0', sha3('eth'), dhr.address);

        console.log(await ens.owner('0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae'));
        console.log(dhr.address);

        await dhr.transfer(sha3('yolo'), oldRegistrar.address);

        tx = await oldRegistrar.configureDomain("yolo", '10000000000000000', 100000, {from: accounts[0]});
        let domainInfo = await oldRegistrar.query(sha3('yolo'), '');
        assert.equal(domainInfo[0], 'yolo');
        assert.equal(domainInfo[1], '10000000000000000');
        assert.equal(domainInfo[2].toNumber(), 0);
        assert.equal(domainInfo[3].toNumber(), 100000);

        await ens.setSubnodeOwner('0x0', sha3('eth'), ethregistrar.address);

        let finalRegistrar = await EthRegistrarSubdomainRegistrar.new(ens.address);

        let migration = await SubdomainMigrationRegistrar.new(
            oldRegistrar.address,
            finalRegistrar.address,
            dhr.address,
            ethregistrar.address
        );

        await oldRegistrar.stop();
        await oldRegistrar.setMigrationAddress(migration.address);

        await oldRegistrar.migrate("yolo");

        domainInfo = await finalRegistrar.query(sha3('yolo'), '');
        assert.equal(domainInfo[0], 'yolo');
        assert.equal(domainInfo[1], '10000000000000000');
        assert.equal(domainInfo[2].toNumber(), 0);
        assert.equal(domainInfo[3].toNumber(), 100000);
    });
});
