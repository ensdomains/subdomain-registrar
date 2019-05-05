require('../open-iconic/font/css/open-iconic-bootstrap.css');
require('html-loader!../index.html');

import { default as Web3} from 'web3';
import { default as contract } from 'truffle-contract';
import { default as namehash } from 'eth-ens-namehash';
import { default as _ } from 'underscore';
import { default as $ } from 'jquery';
import { keccak_256 as sha3 } from 'js-sha3';
import { default as Promise } from 'bluebird';

import subdomainregistrar_artifacts from '../../build/contracts/EthRegistrarSubdomainRegistrar.json';
import ens_artifacts from '../../build/contracts/ENS.json';
import domainnames from './domains.json';

const tld = "eth";
const referrerAddress = "0x0904Dac3347eA47d208F3Fd67402D039a3b99859";

var SubdomainRegistrar = contract(subdomainregistrar_artifacts);
var ENS = contract(ens_artifacts);
Promise.config({cancellation: true});

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

function domainge(infoa, infob) {
  // Rank free domains highest, regardless of referral fee
  if(infoa[1] == 0) return true;
  if(infob[1] == 0) return false;
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
      self.ens = await ENS.deployed();

      // Construct instances of the registrars we know about
      await this.buildInstances();

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
        registrars[domain.registrar] = await ((domain.registrar === undefined) ? SubdomainRegistrar.deployed() : SubdomainRegistrar.at(domain.registrar));
      }
      domainnames[i].contract = registrars[domain.registrar];
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
        if(li.hasClass("disabled") || li.hasClass("list-group-item-danger") || domainge(item.data().info, li.data().info)) {
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
