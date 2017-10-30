var ENS = artifacts.require("ENS");
var SubdomainRegistrar = artifacts.require("SubdomainRegistrar");

var namehash = require('eth-ens-namehash');
var sha3 = require('js-sha3').keccak_256;
var Promise = require('bluebird');

var domainnames = require('../app/js/domains.json');

module.exports = function(deployer, network, accounts) {
  deployer.deploy(ENS).then(function() {
    return ENS.deployed().then(function(ens) {
      return ens.setSubnodeOwner(0, '0x' + sha3('eth'), accounts[0]).then(function() {
        return deployer.deploy(SubdomainRegistrar, ens.address).then(function() {
          return SubdomainRegistrar.deployed().then(function(registrar) {
            return Promise.map(domainnames, async function(name) {
              console.log("Configuring " + name + ".eth");
              await ens.setSubnodeOwner(namehash.hash('eth'), '0x' + sha3(name), accounts[0]);
              await registrar.configureDomain(name, 1e17, 100000);
              await ens.setOwner(namehash.hash(name + ".eth"), registrar.address);
            });
          });
        });
      });
    });
  });
};
