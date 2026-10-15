require('../open-iconic/font/css/open-iconic-bootstrap.css');
require('html-loader!../index.html');

import { default as Web3} from 'web3';
import { default as contract } from 'truffle-contract';
import { default as namehash } from 'eth-ens-namehash';
import { default as _ } from 'underscore';
import { default as $ } from 'jquery';
import { keccak_256 as sha3 } from 'js-sha3';
import { default as Promise } from 'bluebird';

import subdomainregistrar_artifacts from '../../build/contracts/ENSMigrationSubdomainRegistrar.json';
import ens_artifacts from '../../build/contracts/ENSRegistryWithFallback.json';
import domainnames from './domains.json';

const tld = "eth";
const ensAddress = "0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e";
const referrerAddress = "0x0904Dac3347eA47d208F3Fd67402D039a3b99859";
const defaultSubdomainRegistrar = "0xe65d8AAF34CB91087D1598e0A15B582F57F217d9";
const recentRegistrationBlockWindow = 50000;
const recentRegistrationBlockChunkSize = 10000;
const registrationRequestTimeout = 15000;
const newRegistrationTopic = "0x" + sha3("NewRegistration(bytes32,string,address,address,uint256)");
let rpcRequestId = 0;

var SubdomainRegistrar = contract(subdomainregistrar_artifacts);
var ENS = contract(ens_artifacts);
Promise.config({cancellation: true});

function requestRpc(method, params) {
  return new Promise(function(resolve, reject) {
    var provider = web3.currentProvider;
    var settled = false;
    var request = {
      jsonrpc: "2.0",
      id: ++rpcRequestId,
      method: method,
      params: params
    };
    var timeout = setTimeout(function() {
      settled = true;
      reject(new Error("Timed out while requesting " + method + "."));
    }, registrationRequestTimeout);
    var onSuccess = function(value) {
      if(settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(value);
    };
    var onFailure = function(error) {
      if(settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    };

    try {
      if(provider && typeof provider.request === "function") {
        provider.request({method: method, params: params}).then(onSuccess, onFailure);
        return;
      }

      if(!provider || typeof provider.sendAsync !== "function") {
        onFailure(new Error("The current provider does not support JSON-RPC requests."));
        return;
      }

      provider.sendAsync(request, function(error, response) {
        if(error) {
          onFailure(error);
        } else if(response && response.error) {
          onFailure(new Error(response.error.message));
        } else {
          onSuccess(response && response.result);
        }
      });
    } catch(error) {
      onFailure(error);
    }
  });
}

var registrarVersions = {
  "1.0": {
    query: async function(domain, subdomain) {
      return domain.contract.query('0x' + sha3(domain.name), subdomain);
    },
    register: async function(domain, subdomain, ownerAddress, referrerAddress, resolverAddress, value) {
      return domain.contract.register(
        '0x' + sha3(domain.name),
        subdomain,
        ownerAddress,
        referrerAddress,
        resolverAddress,
        {
          from: ownerAddress,
          value: value,
        });
    }
  }
};

function domainge(infoa, infob, domaina, domainb) {
  // Rank free domains highest
  var freeA = infoa[1] == 0;
  var freeB = infob[1] == 0;
  if(freeA !== freeB) return freeA;
  // Then rank by recent registrations referred by this dapp
  var recentRegistrationsA = domaina.recentRegistrations || 0;
  var recentRegistrationsB = domainb.recentRegistrations || 0;
  if(recentRegistrationsA !== recentRegistrationsB) return recentRegistrationsA > recentRegistrationsB;
  // Then rank by referral fee descending
  if(!infoa[3].eq(infob[3])) return infoa[3].gte(infob[3]);
  // Then rank by price ascending
  if(!infoa[1].eq(infob[1])) return infoa[1].lt(infob[1]);
  // Finally sort alphabetically
  return infoa[0] < infob[0];
}

window.App = {
  start: async function() {
    var self = this;

    SubdomainRegistrar.setProvider(web3.currentProvider);
    ENS.setProvider(web3.currentProvider);

    try {
      self.ens = await ENS.at(ensAddress);

      // Construct instances of the registrars we know about
      await this.buildInstances();
      await this.loadRecentRegistrationCounts(domainnames);

      // Get the address of the current public resolver
      self.resolverAddress = await self.ens.resolver(namehash.hash('resolver.eth'));
    } catch(e) {
      console.log(e);
      $("#wrongnetworkmodal").modal('show');
    }

    $("#name").keyup(function() {
      try {
        var name = $("#name");
        namehash.normalize(name.val());
        name.get(0).setCustomValidity("");
      } catch(e) {
        name.get(0).setCustomValidity("Please provide a valid domain name");
      }
    });

    $("#name").keyup(_.debounce(function() {
        var name = $("#name");
        if(!name.get(0).validity.valid) {
          self.clearDomains();
          return;
        }
        var subdomain = namehash.normalize($("#name").val().trim());
        $("#name").val(subdomain);

        if(subdomain == this.last) return;
        this.last = subdomain;

        self.clearDomains();
        if(this.lookups !== undefined) {
          this.lookups.cancel();
        }
        if(subdomain != "") {
          self.checkDomains(domainnames, subdomain, 2);
        }
    }.bind(this), 500));
  },
  buildInstances: async function() {
    var registrars = {};
    for(var i = 0; i < domainnames.length; i++) {
      var domain = domainnames[i];
      if(registrars[domain.registrar] === undefined) {
        registrars[domain.registrar] = await ((domain.registrar === undefined) ? SubdomainRegistrar.at(defaultSubdomainRegistrar) : SubdomainRegistrar.at(domain.registrar));
      }
      domainnames[i].contract = registrars[domain.registrar];
    }
  },
  loadRecentRegistrationCounts: async function(domains) {
    var registrarGroups = {};
    domains.forEach(function(domain) {
      domain.recentRegistrations = 0;

      var registrarAddress = (domain.contract && domain.contract.address) || defaultSubdomainRegistrar;
      var registrarKey = registrarAddress.toLowerCase();
      if(registrarGroups[registrarKey] === undefined) {
        registrarGroups[registrarKey] = {address: registrarAddress, domains: []};
      }
      registrarGroups[registrarKey].domains.push(domain);
    });

    try {
      var latestBlockHex = await requestRpc("eth_blockNumber", []);
      var latestBlock = parseInt(latestBlockHex, 16);
      var fromBlock = Math.max(0, latestBlock - recentRegistrationBlockWindow + 1);
      var referrerTopic = "0x000000000000000000000000" + referrerAddress.slice(2).toLowerCase();

      await Promise.all(Object.keys(registrarGroups).map(async function(registrarKey) {
        var group = registrarGroups[registrarKey];
        var domainsByLabel = {};
        var labels = group.domains.map(function(domain) {
          var label = "0x" + sha3(domain.name).toLowerCase();
          domainsByLabel[label] = domain;
          return label;
        });
        var blockRanges = [];
        for(var startBlock = fromBlock; startBlock <= latestBlock; startBlock += recentRegistrationBlockChunkSize) {
          var endBlock = Math.min(startBlock + recentRegistrationBlockChunkSize - 1, latestBlock);
          blockRanges.push({
            fromBlock: "0x" + startBlock.toString(16),
            toBlock: "0x" + endBlock.toString(16)
          });
        }
        var logResults;
        try {
          logResults = await Promise.map(blockRanges, function(blockRange) {
            return requestRpc("eth_getLogs", [{
              address: group.address,
              fromBlock: blockRange.fromBlock,
              toBlock: blockRange.toBlock,
              topics: [newRegistrationTopic, labels, null, referrerTopic]
            }]);
          }, {concurrency: 3});
        } catch(error) {
          console.log("Unable to load recent registrations for " + group.address, error);
          return;
        }
        var logs = [].concat.apply([], logResults);

        logs.forEach(function(log) {
          var domain = domainsByLabel[log.topics[1].toLowerCase()];
          if(domain) domain.recentRegistrations++;
        });
      }));
    } catch(error) {
      console.log("Unable to load recent registration counts", error);
    }
  },
  clearDomains: function() {
    $('#results').empty();
  },
  checkDomains: async function(domains, subdomain, parallelism) {
    this.lookups = Promise.map(
      domains,
      async function(domain) {
        var name = subdomain + "." + domain.name + "." + tld;

        var item = $('<a href="#" class="list-group-item list-group-item-action flex-column align-items-start disabled">');
        item.data({domain: domain, subdomain: subdomain});

        var namediv = $('<div class="d-flex w-100 justify-content-between">');
        namediv.append($('<h5 class="mb-1">').text(name));
        var icon = $('<span class="icon">');
        namediv.append(icon.append($('<span class="oi oi-ellipses">')));
        item.append(namediv);

        var insertPoint = $('#results .list-group-item-danger');
        if(insertPoint.length == 0) {
          item.appendTo($('#results'));
        } else {
          item.insertBefore(insertPoint.first());
        }

        var info = await registrarVersions[domain.version].query(domain, subdomain);
        item.removeClass("disabled");
        this.setItemState(domain, subdomain, item, info);
      }.bind(this),
      {concurrency: 4}
    );
    await this.lookups;
    this.lookups = undefined;
  },
  setItemState: function(domain, subdomain, item, info) {
    if(subdomain != this.last) return;

    item.data().info = info;
    if(info[0] == "") {
      $(".icon", item).empty().append($('<span class="oi oi-circle-x">'));
      item.removeClass("list-group-item-success");
      item.addClass("list-group-item-danger");
      item.appendTo($('#results'));
    } else {
      var cost = web3.fromWei(info[1]);
      $(".icon", item).empty().append($('<span class="badge badge-primary badge-pill">').text("Ξ" + cost));
      item.removeClass("list-group-item-danger");
      item.addClass("list-group-item-success");
      item.click(() => this.buySubdomain(domain, subdomain, item, info));

      // Find the correct insertion point
      for(var li of $('#results a')) {
        li = $(li);
        if(li.hasClass("disabled") || li.hasClass("list-group-item-danger") ||
          domainge(item.data().info, li.data().info, item.data().domain, li.data().domain)) {
          item.insertBefore(li);
          return;
        }
      }
      item.appendTo($('#results'));
    }
  },
  buySubdomain: async function(domain, subdomain, item, info) {
    if(readOnly) {
      $("#readonlymodal").modal('show');
      return;
    }

    $(".domainname").text(subdomain + "." + domain.name + "." + tld);
    $("#registeringmodal").modal('show');
    var tx = await registrarVersions[domain.version].register(domain, subdomain, web3.eth.accounts[0], referrerAddress, this.resolverAddress, info[1]);
    $("#etherscan").attr("href", "https://etherscan.io/tx/" + tx.tx);
    $("#registeringmodal").modal('hide');
    $("#registeredmodal").modal('show');
    info[0] = '';
    this.setItemState(domain, subdomain, item, info);
  }
};

window.addEventListener('load', async function() {
  // Checking if Web3 has been injected by the browser (Mist/MetaMask)
  if (typeof ethereum !== 'undefined') {
    // Use Mist/MetaMask's provider
    await ethereum.enable();
    window.web3 = new Web3(ethereum);
    window.readOnly = false;
  } else {
    window.web3 = new Web3(new Web3.providers.HttpProvider("https://mainnet.infura.io/Rg6BrBl8vIqJBc7AlL9h"));
    window.readOnly = true;
  }

  App.start();
});
