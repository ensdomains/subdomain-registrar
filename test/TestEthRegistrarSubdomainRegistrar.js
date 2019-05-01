const ENS = artifacts.require("ENSRegistry");
const EthRegistrarSubdomainRegistrar = artifacts.require("EthRegistrarSubdomainRegistrar");
const HashRegistrar = artifacts.require("HashRegistrar");
const EthRegistrar = artifacts.require("BaseRegistrarImplementation");
const TestResolver = artifacts.require("TestResolver");

const utils = require('./helpers/Utils');

var namehash = require('eth-ens-namehash');
const sha3 = require('web3-utils').sha3;

const DAYS = 24 * 60 * 60;

contract('EthRegistrarSubdomainRegistrar', function (accounts) {
    var ens = null;
    var ethregistrar = null;
    var registrar = null;
    var resolver = null;

    before(async function () {
      ens = await ENS.deployed();
      dhr = await HashRegistrar.deployed();
      resolver = await TestResolver.deployed();

      ethregistrar = await EthRegistrar.new(
          ens.address,
          dhr.address,
          namehash.hash('eth'),
          Math.floor(Date.now() / 1000) * 2
      );
      await ethregistrar.addController(accounts[0]);
      await ens.setSubnodeOwner('0x0', sha3('eth'), ethregistrar.address);

      resolver = await TestResolver.deployed();

      registrar = await EthRegistrarSubdomainRegistrar.new(ens.address);
    });

    it('should set up a domain', async function () {
        await ethregistrar.register(sha3('test'), accounts[0], 86400);
        await ethregistrar.approve(registrar.address, sha3('test'));

        tx = await registrar.configureDomain('test', '10000000000000000', 100000, {from: accounts[0]});
        assert.equal(tx.logs.length, 1);
        assert.equal(tx.logs[0].event, 'DomainConfigured');
        assert.equal(tx.logs[0].args.label, sha3('test'));

        var domainInfo = await registrar.query(sha3('test'), '');
        assert.equal(domainInfo[0], 'test');
        assert.equal(domainInfo[1], '10000000000000000');
        assert.equal(domainInfo[2].toNumber(), 0);
        assert.equal(domainInfo[3].toNumber(), 100000);

        assert.equal(await ens.owner(namehash.hash('test.eth')), registrar.address);
    });

    it("should fail to register a subdomain if it hasn't been transferred", async function () {
        try {
            await registrar.register(sha3('foo'), 'test', accounts[0], accounts[0], resolver.address, {value: '10000000000000000'});
            assert.fail('Expected error not encountered');
        } catch (error) {
        }
    });

    it("should register subdomains", async function () {
        var ownerBalanceBefore = (await web3.eth.getBalance(accounts[0]));
        var referrerBalanceBefore = (await web3.eth.getBalance(accounts[2]));

        var tx = await registrar.register(sha3('test'), 'foo', accounts[1], accounts[2], resolver.address, {
            from: accounts[1],
            value: '10000000000000000'
        });
        assert.equal(tx.logs.length, 1);
        assert.equal(tx.logs[0].event, 'NewRegistration');
        assert.equal(tx.logs[0].args.label, sha3('test'));
        assert.equal(tx.logs[0].args.subdomain, 'foo');
        assert.equal(tx.logs[0].args.owner, accounts[1]);
        assert.equal(tx.logs[0].args.price, '10000000000000000');
        assert.equal(tx.logs[0].args.referrer, accounts[2]);

        // Check owner and referrer get their fees
        assert.equal((await web3.eth.getBalance(accounts[0])) - ownerBalanceBefore, 9e15);
        assert.equal((await web3.eth.getBalance(accounts[2])) - referrerBalanceBefore, 1e15);

        // Check the new owner gets their domain
        assert.equal(await ens.owner(namehash.hash('foo.test.eth')), accounts[1]);
        assert.equal(await ens.resolver(namehash.hash('foo.test.eth')), resolver.address);
        assert.equal(await resolver.addr(namehash.hash('foo.test.eth')), accounts[1]);
    });

    it("should not permit duplicate registrations", async function () {
        try {
            await registrar.register(sha3('test'), 'foo', accounts[0], accounts[0], resolver.address, {value: '10000000000000000'});
            assert.fail('Expected error not encountered');
        } catch (error) {
        }
    });

    it("should not allow non-owners to configure domains", async function () {
        try {
            await registrar.configureDomain("toast", '1000000000000000000', 0);
            assert.fail('Expected error not encountered');
        } catch (error) {
        }
    });

    it("should not allow a non-owner to unlist a valid domain", async function () {
        try {
            await registrar.unlistDomain('test', {from: accounts[1]});
            assert.fail('Expected error not encountered');
        } catch (error) {
        }
    });

    it("should allow an owner to unlist a domain", async function () {
        var tx = await registrar.unlistDomain('test');
        assert.equal(tx.logs.length, 1);
        assert.equal(tx.logs[0].args.label, sha3('test'));
    });

    it("should not allow subdomain registrations for an unlisted domain", async function () {
        try {
            await registrar.register(sha3('test'), 'bar', accounts[0], accounts[0], resolver.address, {value: '10000000000000000'});
            assert.fail('Expected error not encountered');
        } catch (error) {
        }
    });

    it("should allow an owner to relist a domain", async function () {
        tx = await registrar.configureDomain('test', '10000000000000000', 100000);
        assert.equal(tx.logs.length, 1);
        assert.equal(tx.logs[0].event, 'DomainConfigured');
        assert.equal(tx.logs[0].args.label, sha3('test'));

        var domainInfo = await registrar.query(sha3('test'), '');
        assert.equal(domainInfo[0], 'test');
        assert.equal(domainInfo[1], '10000000000000000');
        assert.equal(domainInfo[2].toNumber(), 0);
        assert.equal(domainInfo[3].toNumber(), 100000);
    });

    it("should allow migration if emergency stopped", async function () {
        await ethregistrar.register(sha3('migration'), accounts[1], 86400);
        await ethregistrar.approve(registrar.address, sha3('migration'), {from: accounts[1]});
        await registrar.configureDomain("migration", '1000000000000000000', 0, {from: accounts[1]});

        let newRegistrar = await EthRegistrarSubdomainRegistrar.new(ens.address);

        await registrar.stop();
        await registrar.setMigrationAddress(newRegistrar.address);

        try {
            // Don't allow anyone else to migrate the name.
            await registrar.migrate("migration");
            assert.fail('Expected error not encountered');
        } catch (error) {
        }

        await registrar.migrate("migration", {from: accounts[1]});
        assert.equal(await ens.owner(namehash.hash('migration.eth')), newRegistrar.address);
    });
});
