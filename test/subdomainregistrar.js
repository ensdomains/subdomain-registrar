var ENS = artifacts.require("ENS");
var SubdomainRegistrar = artifacts.require("SubdomainRegistrar");
var DummyHashRegistrar = artifacts.require("DummyHashRegistrar");
var TestResolver = artifacts.require("TestResolver");
var Deed = artifacts.require("Deed");

var namehash = require('eth-ens-namehash');
var sha3 = require('js-sha3').keccak_256;

contract('SubdomainRegistrar', function(accounts) {
  var ens = null;
  var dhr = null;
  var registrar = null;
  var resolver = null;

  before(async function() {
    registrar = await SubdomainRegistrar.deployed();
    ens = await ENS.deployed();
    dhr = await DummyHashRegistrar.deployed();
    resolver = await TestResolver.deployed();
  });

  it('should set up a domain', async function() {
    var tx = await dhr.setSubnodeOwner('0x' + sha3('test'), accounts[0]);
    await dhr.transfer('0x' + sha3('test'), registrar.address);
    assert.equal(tx.receipt.logs.length, 1);

    tx = await registrar.configureDomain("test", 1e17, 100000);
    assert.equal(tx.logs.length, 1);
    assert.equal(tx.logs[0].event, 'DomainConfigured');
    assert.equal(tx.logs[0].args.label, '0x' + sha3('test'));

    var domainInfo = await registrar.query('0x' + sha3('test'), '');
    assert.equal(domainInfo[0], 'test');
    assert.equal(domainInfo[1].toNumber(), 1e17);
    assert.equal(domainInfo[2].toNumber(), 0);
    assert.equal(domainInfo[3].toNumber(), 100000);
  });

  it("should fail to register a subdomain if it hasn't been transferred", async function() {
    try {
      await registrar.register('0x' + sha3('foo'), 'test', accounts[0], accounts[0], resolver.address, {value: 1e17});
      assert.fail('Expected error not encountered');
    } catch(error) { }
  });

  it("should register subdomains", async function() {
    var ownerBalanceBefore = (await web3.eth.getBalance(accounts[0])).toNumber();
    var referrerBalanceBefore = (await web3.eth.getBalance(accounts[2])).toNumber();

    var tx = await registrar.register('0x' + sha3('test'), 'foo', accounts[1], accounts[2], resolver.address, {from: accounts[1], value: 1e17});
    assert.equal(tx.logs.length, 1);
    assert.equal(tx.logs[0].event, 'NewRegistration');
    assert.equal(tx.logs[0].args.label, '0x' + sha3('test'));
    assert.equal(tx.logs[0].args.subdomain, 'foo');
    assert.equal(tx.logs[0].args.owner, accounts[1]);
    assert.equal(tx.logs[0].args.price.toNumber(), 1e17);
    assert.equal(tx.logs[0].args.referrer, accounts[2]);

    // Check owner and referrer get their fees
    assert.equal((await web3.eth.getBalance(accounts[0])).toNumber() - ownerBalanceBefore, 9e16);
    assert.equal((await web3.eth.getBalance(accounts[2])).toNumber() - referrerBalanceBefore, 1e16);

    // Check the new owner gets their domain
    assert.equal(await ens.owner(namehash.hash('foo.test.eth')), accounts[1]);
    assert.equal(await ens.resolver(namehash.hash('foo.test.eth')), resolver.address);
    assert.equal(await resolver.addr(namehash.hash('foo.test.eth')), accounts[1]);
  });

  it("should not permit duplicate registrations", async function() {
    try {
      await registrar.register('0x' + sha3('test'), 'foo', accounts[0], accounts[0], resolver.address, {value: 1e17});
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
    assert.equal(tx.logs[0].args.label, '0x' + sha3('test'));
  });

  it("should not allow subdomain registrations for an unlisted domain", async function() {
    try {
      await registrar.register('0x' + sha3('test'), 'bar', accounts[0], accounts[0], resolver.address, {value: 1e17});
      assert.fail('Expected error not encountered');
    } catch(error) { }
  });

  it("should allow an owner to relist a domain", async function() {
    tx = await registrar.configureDomain("test", 1e17, 100000);
    assert.equal(tx.logs.length, 1);
    assert.equal(tx.logs[0].event, 'DomainConfigured');
    assert.equal(tx.logs[0].args.label, '0x' + sha3('test'));

    var domainInfo = await registrar.query('0x' + sha3('test'), '');
    assert.equal(domainInfo[0], 'test');
    assert.equal(domainInfo[1].toNumber(), 1e17);
    assert.equal(domainInfo[2].toNumber(), 0);
    assert.equal(domainInfo[3].toNumber(), 100000);
  });

  it("should allow an owner to set a transfer address", async function () {
    tx = await registrar.setTransferAddress("test", accounts[2], {from: accounts[0]});
    assert.equal(tx.logs.length, 1);
    assert.equal(tx.logs[0].event, 'TransferAddressSet');
    assert.equal(tx.logs[0].args.addr, accounts[2]);
  });

  it("should allow an owner to upgrade domain", async function () {
      await ens.setSubnodeOwner(0, '0x' + sha3('eth'), accounts[1]);
      let tx = await registrar.upgrade('test', {from: accounts[0]});
      assert.equal(tx.logs.length, 1);
      assert.equal(tx.logs[0].event, 'DomainUpgraded');
      assert.equal(tx.logs[0].args.label, 'test');
  });

});
