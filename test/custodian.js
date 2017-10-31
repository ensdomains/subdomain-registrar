var Custodian = artifacts.require("Custodian");
var Deed = artifacts.require("Deed");
var DummyHashRegistrar = artifacts.require("DummyHashRegistrar");
var ENS = artifacts.require("ENS");

var namehash = require('eth-ens-namehash');
var sha3 = require('js-sha3').keccak_256;

contract('Custodian', function(accounts) {
  var ens = null;
  var dhr = null;
  var custodian = null;

  before(async function() {
    ens = await ENS.deployed();
    dhr = await DummyHashRegistrar.deployed();
    custodian = await Custodian.deployed();
  });

  var label = '0x' + sha3('deedtest');

  it('should take ownership of a deed', async function() {

    // Create deedtest.eth
    await dhr.setSubnodeOwner(label, accounts[0]);
    assert.equal(await custodian.owner(label), accounts[0]);
    assert.equal(await ens.owner(namehash.hash('deedtest.eth')), accounts[0]);

    // Transfer it to the custodian
    await dhr.transfer(label, custodian.address);
    assert.equal(await custodian.owner(label), accounts[0]);
    assert.equal(await ens.owner(namehash.hash('deedtest.eth')), custodian.address);
  });

  it('should allow a transfer of ownership', async function() {
    await custodian.transfer(label, accounts[1]);
    assert.equal(await custodian.owner(label), accounts[1]);
    // Ownership of the ENS record should *not* change
    assert.equal(await ens.owner(namehash.hash('deedtest.eth')), custodian.address);
  });

  it('should not allow a non-owner to transfer ownership', async function() {
    try {
      await custodian.transfer(label, accounts[0]);
      assert.fail("Expected exception");
    } catch(e) { }
  });

  it('should not allow a non-owner to assign ENS ownership', async function() {
    try {
      await custodian.assign(label, accounts[2]);
      assert.fail("Expected exception");
    } catch(e) { }
  });

  it('should allow the owner to assign ENS ownership once', async function() {
    await custodian.assign(label, accounts[2], {from: accounts[1]});
    assert.equal(await ens.owner(namehash.hash('deedtest.eth')), accounts[2]);
  });

  it('should not allow reassignment of ENS ownership', async function() {
    try {
      await custodian.assign(label, accounts[3], {from: accounts[1]});
      assert.fail("Expected exception");
    } catch(e) { }
  });

  it('should not allow reclaiming ownership before the registrar changes', async function() {
    try {
      await custodian.claim(label, {from: accounts[1]});
      assert.fail("Expected exception");
    } catch(e) { }
  });

  it('should allow reclaiming ownership after a registrar change', async function() {
    // Set a new .eth registrar
    await ens.setSubnodeOwner(0, '0x' + sha3('eth'), accounts[0]);

    // Claim the deed back from the custodian
    await custodian.claim(label, {from: accounts[1]});

    // Check it's been reassigned to us
    var entry = await dhr.entries(label);
    var deed = Deed.at(entry[1]);
    assert.equal(await deed.owner(), accounts[1]);

    // Registrar is no longer the ENS owner, so can't reassign ENS ownership
    assert.equal(await ens.owner(namehash.hash('deedtest.eth')), accounts[2]);
  });
});
