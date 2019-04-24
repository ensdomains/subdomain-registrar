var ENS = artifacts.require("ENSRegistry");
var SubdomainRegistrar = artifacts.require("SubdomainRegistrar");
var EthRegistrarSubdomainRegistrar = artifacts.require("EthRegistrarSubdomainRegistrar");
var SubdomainMigrationRegistrar = artifacts.require("SubdomainMigrationRegistrar");
var EthRegistrar = artifacts.require("BaseRegistrarImplementation");
var DummyHashRegistrar = artifacts.require("DummyHashRegistrar");
var TestResolver = artifacts.require("TestResolver");

var sha3 = require('js-sha3').keccak_256;

contract('SubdomainRegistrar', function (accounts) {
    var ens = null;
    var dhr = null;
    var oldRegistrar = null;
    var resolver = null;
    var ethregistrar = null;

    before(async function () {
        oldRegistrar = await SubdomainRegistrar.deployed();
        ens = await ENS.deployed();
        dhr = await DummyHashRegistrar.deployed();
        resolver = await TestResolver.deployed();

        ethregistrar = await EthRegistrar.new(ens.address, dhr.address, '0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae', Math.floor(Date.now() / 1000) * 2)

    });

    it.only('should migrate domain', async function () {
        tx = await dhr.setSubnodeOwner('0x' + sha3('test'), accounts[0]);
        await dhr.transfer('0x' + sha3('test'), oldRegistrar.address);

        tx = await oldRegistrar.configureDomain("test", '10000000000000000', 100000, {from: accounts[0]});
        let domainInfo = await oldRegistrar.query('0x' + sha3('test'), '');
        assert.equal(domainInfo[0], 'test');
        assert.equal(domainInfo[1], '10000000000000000');
        assert.equal(domainInfo[2].toNumber(), 0);
        assert.equal(domainInfo[3].toNumber(), 100000);

        await ens.setSubnodeOwner('0x0', '0x' + sha3('eth'), ethregistrar.address);

        let finalRegistrar = await EthRegistrarSubdomainRegistrar.new(ens.address);

        let migration = await SubdomainMigrationRegistrar.new(
            oldRegistrar.address,
            finalRegistrar.address,
            dhr.address,
            ethregistrar.address
        );

        await oldRegistrar.stop();
        await oldRegistrar.setMigrationAddress(migration.address);

        await oldRegistrar.migrate("test");

        domainInfo = await finalRegistrar.query('0x' + sha3('test'), '');
        assert.equal(domainInfo[0], 'test');
        assert.equal(domainInfo[1], '10000000000000000');
        assert.equal(domainInfo[2].toNumber(), 0);
        assert.equal(domainInfo[3].toNumber(), 100000);
    });
});