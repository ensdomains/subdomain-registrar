var ENS = artifacts.require("ENS");
var SubdomainRegistrar = artifacts.require("SubdomainRegistrar");
var DummyHashRegistrar = artifacts.require("DummyHashRegistrar");

var namehash = require('eth-ens-namehash');
var sha3 = require('js-sha3').keccak_256;

contract('DNSRegistrar', function(accounts) {
  var ens = null;
  var dhr = null;
  var registrar = null;

  before(async function() {
    registrar = await SubdomainRegistrar.deployed();
    ens = await ENS.deployed();
    dhr = await DummyHashRegistrar.deployed();
  });

  it('should set up a domain', async function() {
    var tx = await dhr.setSubnodeOwner('0x' + sha3('test'), accounts[0]);
    assert.equal(tx.receipt.logs.length, 1);

    tx = await registrar.configureDomain("test", 1e17, 100000);
    assert.equal(tx.logs.length, 1);
    assert.equal(tx.logs[0].event, 'DomainConfigured');
    assert.equal(tx.logs[0].args.name, '0x' + sha3('test'));
    assert.equal(tx.logs[0].args.price.toNumber(), 1e17);
    assert.equal(tx.logs[0].args.referralFeePPM.toNumber(), 100000);

    var domainInfo = await registrar.domains('0x' + sha3('test'));
    assert.equal(domainInfo[0], 'test');
    assert.equal(domainInfo[1], accounts[0]);
    assert.equal(domainInfo[2].toNumber(), 1e17);
    assert.equal(domainInfo[3].toNumber(), 100000);
  });

  it("should fail to register a subdomain if it hasn't been transferred", async function() {
    try {
      await registrar.register('foo', '0x' + sha3('test'), accounts[0], accounts[0], {value: 1e17});
      assert.fail('Expected error not encountered');
    } catch(error) { }
  });

  it("should register subdomains", async function() {
    await ens.setOwner(namehash.hash('test.eth'), registrar.address);
    var ownerBalanceBefore = (await web3.eth.getBalance(accounts[0])).toNumber();
    var referrerBalanceBefore = (await web3.eth.getBalance(accounts[2])).toNumber();

    var tx = await registrar.register('test', '0x' + sha3('foo'), accounts[1], accounts[2], {from: accounts[1], value: 1e17});
    assert.equal(tx.logs.length, 1);
    assert.equal(tx.logs[0].event, 'NewRegistration');
    assert.equal(tx.logs[0].args.name, '0x' + sha3('test'));
    assert.equal(tx.logs[0].args.label, '0x' + sha3('foo'));
    assert.equal(tx.logs[0].args.owner, accounts[1]);
    assert.equal(tx.logs[0].args.price.toNumber(), 1e17);
    assert.equal(tx.logs[0].args.referrer, accounts[2]);

    // Check owner and referrer get their fees
    assert.equal((await web3.eth.getBalance(accounts[0])).toNumber() - ownerBalanceBefore, 9e16);
    assert.equal((await web3.eth.getBalance(accounts[2])).toNumber() - referrerBalanceBefore, 1e16);

    // Check the new owner gets their domain
    assert.equal(await ens.owner(namehash.hash('foo.test.eth')), accounts[1]);
    assert.equal(await ens.resolver(namehash.hash('foo.test.eth')), await registrar.basicResolver());
  });

  it("should not permit duplicate registrations", async function() {
    try {
      await registrar.register('test', '0x' + sha3('foo'), accounts[0], accounts[0], {value: 1e17});
      assert.fail('Expected error not encountered');
    } catch(error) { }
  });

  it("should not allow non-owners to configure domains", async function() {
    try{
      await registrar.configureDomain("toast", 1e18, 0);
      assert.fail('Expected error not encountered');
    } catch(error) { }
  });

  it("should not allow a non-owner to unlist a valid domain", async function() {
    try {
      await registrar.unlistDomain('test', {from: accounts[1]});
      assert.fail('Expected error not encountered');
    } catch(error) { }
  });

  it("should allow an owner to unlist a domain", async function() {
    var tx = await registrar.unlistDomain('test');
    assert.equal(tx.logs.length, 1);
    assert.equal(tx.logs[0].args.name, '0x' + sha3('test'));
  });

  it("should not allow subdomain registrations for an unlisted domain", async function() {
    try {
      await registrar.register('test', '0x' + sha3('bar'), accounts[0], accounts[0], {value: 1e17});
      assert.fail('Expected error not encountered');
    } catch(error) { }
  });

  it("should allow an owner to relist a domain", async function() {
    tx = await registrar.configureDomain("test", 1e17, 100000);
    assert.equal(tx.logs.length, 1);
    assert.equal(tx.logs[0].event, 'DomainConfigured');
    assert.equal(tx.logs[0].args.name, '0x' + sha3('test'));
    assert.equal(tx.logs[0].args.price.toNumber(), 1e17);
    assert.equal(tx.logs[0].args.referralFeePPM.toNumber(), 100000);

    var domainInfo = await registrar.domains('0x' + sha3('test'));
    assert.equal(domainInfo[0], 'test');
    assert.equal(domainInfo[1], accounts[0]);
    assert.equal(domainInfo[2].toNumber(), 1e17);
    assert.equal(domainInfo[3].toNumber(), 100000);
  });

  it("should allow external transfer of ownership", async function() {
    await dhr.setSubnodeOwner('0x' + sha3('test'), accounts[1]);
    tx = await registrar.configureDomain("test", 1e16, 10000, {from: accounts[1]});
    assert.equal(tx.logs.length, 1);
    assert.equal(tx.logs[0].event, 'DomainConfigured');
    assert.equal(tx.logs[0].args.name, '0x' + sha3('test'));
    assert.equal(tx.logs[0].args.price.toNumber(), 1e16);
    assert.equal(tx.logs[0].args.referralFeePPM.toNumber(), 10000);

    var domainInfo = await registrar.domains('0x' + sha3('test'));
    assert.equal(domainInfo[0], 'test');
    assert.equal(domainInfo[1], accounts[1]);
    assert.equal(domainInfo[2].toNumber(), 1e16);
    assert.equal(domainInfo[3].toNumber(), 10000);
  });
});
