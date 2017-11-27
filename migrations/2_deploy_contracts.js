var DummyHashRegistrar = artifacts.require("DummyHashRegistrar");
var TestResolver = artifacts.require("TestResolver");
var ENS = artifacts.require("ENS");
var SubdomainRegistrar = artifacts.require("SubdomainRegistrar");

var namehash = require('eth-ens-namehash');
var sha3 = require('js-sha3').keccak_256;
var Promise = require('bluebird');

var domainnames = require('../app/js/domains.json');

module.exports = function(deployer, network, accounts) {
  function stage2(ens, dhr) {
    return deployer.deploy(SubdomainRegistrar, ens.address).then(function() {
      return SubdomainRegistrar.deployed();
    }).then(function(registrar) {
      if(dhr != undefined) {
        // Configuration of test domains
        return Promise.map(domainnames, async function(name) {
          await dhr.setSubnodeOwner('0x' + sha3(name), accounts[0]);
          await registrar.configureDomain(name, 1e16, 100000);
          await ens.setOwner(namehash.hash(name + ".eth"), registrar.address);
        });
      }
    });
  }

  // if(network == "development") {
    return deployer.deploy(ENS).then(function() {
      return ENS.deployed();
    }).then(function(ens) {
      return deployer.deploy([[DummyHashRegistrar, ens.address], [TestResolver, ens.address]]).then(function() {
        // Set `resolver.eth` to resolve to the test resolver
        return ens.setSubnodeOwner(0, '0x' + sha3('eth'), accounts[0]);
      }).then(function() {
        return ens.setSubnodeOwner(namehash.hash('eth'), '0x' + sha3('resolver'), accounts[0]);
      }).then(function() {
        return TestResolver.deployed();
      }).then(function(resolver) {
        return ens.setResolver(namehash.hash('resolver.eth'), resolver.address);
      }).then(function() {
        return DummyHashRegistrar.deployed();
      }).then(function(dhr) {
        return ens.setSubnodeOwner(0, '0x' + sha3('eth'), dhr.address).then(function() {
          return stage2(ens, dhr);
        });
      });
    });
  // } else {
    // return ENS.deployed().then(stage2);
   // }
};
