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
    await ens.setOwner(namehash.hash('test.eth'), registrar.address);
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

  it("should allow external transfer of ownership", async function() {
    await dhr.setSubnodeOwner('0x' + sha3('test'), accounts[1]);
    tx = await registrar.configureDomain("test", 1e16, 10000, {from: accounts[1]});
    assert.equal(tx.logs.length, 1);
    assert.equal(tx.logs[0].event, 'DomainConfigured');
    assert.equal(tx.logs[0].args.label, '0x' + sha3('test'));

    var domainInfo = await registrar.query('0x' + sha3('test'), '');
    assert.equal(domainInfo[0], 'test');
    assert.equal(domainInfo[1].toNumber(), 1e16);
    assert.equal(domainInfo[2].toNumber(), 0);
    assert.equal(domainInfo[3].toNumber(), 10000);
  });

  context("deed", async function() {
      var label = '0x' + sha3('deedtest');

      it('should take ownership of a deed', async function() {

          // Create deedtest.eth
          await dhr.setSubnodeOwner(label, accounts[0]);
          // Custodian returns 0 until the deed is handed over
          assert.equal(await registrar.deedOwner(label), '0x0000000000000000000000000000000000000000');
          assert.equal(await ens.owner(namehash.hash('deedtest.eth')), accounts[0]);

          // Transfer it to the custodian
          await dhr.transfer(label, registrar.address);
          assert.equal(await registrar.deedOwner(label), accounts[0]);
          assert.equal(await ens.owner(namehash.hash('deedtest.eth')), registrar.address);
      });

      it('should allow a transfer of ownership', async function() {
          await registrar.transferDeed(label, accounts[1]);
          assert.equal(await registrar.deedOwner(label), accounts[1]);
          // Ownership of the ENS record should *not* change
          assert.equal(await ens.owner(namehash.hash('deedtest.eth')), registrar.address);
      });

      it('should not allow a non-owner to transfer ownership', async function() {
          try {
              await registrar.transferDeed(label, accounts[0]);
              assert.fail("Expected exception");
          } catch(e) { }
      });

      it('should not allow a non-owner to assign ENS ownership', async function() {
          try {
              await registrar.assign(label, accounts[2]);
              assert.fail("Expected exception");
          } catch(e) { }
      });

      it('should allow the owner to assign ENS ownership once', async function() {
          await registrar.assign(label, accounts[2], {from: accounts[1]});
          assert.equal(await ens.owner(namehash.hash('deedtest.eth')), accounts[2]);
      });

      it('should not allow reassignment of ENS ownership', async function() {
          try {
              await registrar.assign(label, accounts[3], {from: accounts[1]});
              assert.fail("Expected exception");
          } catch(e) { }
      });

      it('should not allow reclaiming ownership before the registrar changes', async function() {
          try {
              await registrar.claim(label, {from: accounts[1]});
              assert.fail("Expected exception");
          } catch(e) { }
      });

      it('should not permit a transfer of ownership before the deed is assigned to the Custodian', async function() {
          // Create deedtest2.eth
          var label2 = '0x' + sha3('deedtest2');
          await dhr.setSubnodeOwner(label2, accounts[0]);
          try {
              await registrar.transferDeed(label2, accounts[1]);
              assert.fail("Expected exception");
          } catch(e) { }
      });

      it('should allow reclaiming ownership after a registrar change', async function() {
          // Set a new .eth registrar
          await ens.setSubnodeOwner(0, '0x' + sha3('eth'), accounts[0]);

          // Claim the deed back from the custodian
          await registrar.claim(label, {from: accounts[1]});

          // Check it's been reassigned to us
          var entry = await dhr.entries(label);
          var deed = Deed.at(entry[1]);
          assert.equal(await deed.owner(), accounts[1]);

          // Registrar is no longer the ENS owner, so can't reassign ENS ownership
          assert.equal(await ens.owner(namehash.hash('deedtest.eth')), accounts[2]);
      });
  })
});
