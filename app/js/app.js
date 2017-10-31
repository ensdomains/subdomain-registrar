require('../open-iconic/font/css/open-iconic-bootstrap.css');

import { default as Web3} from 'web3';
import { default as contract } from 'truffle-contract';
import { default as namehash } from 'eth-ens-namehash';
import { default as _ } from 'underscore';
import { default as $ } from 'jquery';
import { keccak_256 as sha3 } from 'js-sha3';
import { default as Promise } from 'bluebird';

import subdomainregistrar_artifacts from '../../build/contracts/SubdomainRegistrar.json';
import ens_artifacts from '../../build/contracts/ENS.json';
import domainnames from './domains.json';

const tld = "eth";
const referrerAddress = "0x0904Dac3347eA47d208F3Fd67402D039a3b99859";

var SubdomainRegistrar = contract(subdomainregistrar_artifacts);
var ENS = contract(ens_artifacts);

window.App = {
  start: async function() {
    var self = this;

    SubdomainRegistrar.setProvider(web3.currentProvider);
    self.registrar = await SubdomainRegistrar.deployed();

    ENS.setProvider(web3.currentProvider);
    self.ens = await ENS.deployed();

    // Get the information for all known domains, filtering out any unavailable
    // ones.
    self.domains = await Promise.filter(
      Promise.map(
        domainnames,
        (name) => self.registrar.domains('0x' + sha3(name))),
      (domain) => domain[0].length > 0);

    var last = undefined;
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

        if(subdomain == last) return;
        last = subdomain;

        self.clearDomains();
        if(subdomain != "") {
          for(var domain of self.domains) {
            self.checkDomain(domain, subdomain);
          }
        }
    }, 500));
  },
  clearDomains: function() {
    $('#results').empty();
  },
  checkDomain: async function(domain, subdomain) {
    var name = subdomain + "." + domain[0] + "." + tld;

    var item = $('<a href="#" class="list-group-item list-group-item-action flex-column align-items-start disabled">');

    var namediv = $('<div class="d-flex w-100 justify-content-between">');
    namediv.append($('<h5 class="mb-1">').text(name));
    var icon = $('<span class="icon">');
    namediv.append(icon.append($('<span class="oi oi-ellipses">')));
    item.append(namediv);

    $('#results').append(item);

    var owner = await this.ens.owner(namehash.hash(name));
    item.removeClass("disabled");
    this.setItemState(domain, subdomain, item, owner != "0x0000000000000000000000000000000000000000");
  },
  setItemState: function(domain, subdomain, item, owned) {
    if(owned) {
      $(".icon", item).empty().append($('<span class="oi oi-circle-x">'));
      item.removeClass("list-group-item-success");
      item.addClass("list-group-item-danger");
    } else {
      var cost = web3.fromWei(domain[2]);
      $(".icon", item).empty().append($('<span class="badge badge-primary badge-pill">').text("Ξ" + cost));
      item.removeClass("list-group-item-danger");
      item.addClass("list-group-item-success");
      item.click(() => this.buySubdomain(domain, subdomain, item));
    }
  },
  buySubdomain: async function(domain, subdomain, item) {
    $(".domainname").text(subdomain + "." + domain[0] + "." + tld);
    $("#registeringmodal").modal('show');
    var tx = await this.registrar.register(
      domain[0],
      '0x' + sha3(subdomain),
      web3.eth.accounts[0],
      referrerAddress,
      {
        from: web3.eth.accounts[0],
        value: domain[2],
      });
    $("#etherscan").attr("href", "https://etherscan.io/tx/" + tx.tx);
    $("#registeringmodal").modal('hide');
    $("#registeredmodal").modal('show');
    this.setItemState(domain, subdomain, item, true);
  }
};

window.addEventListener('load', function() {
  // Checking if Web3 has been injected by the browser (Mist/MetaMask)
  if (typeof web3 !== 'undefined') {
    // Use Mist/MetaMask's provider
    window.web3 = new Web3(web3.currentProvider);
  } else {
    window.web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
  }

  App.start();
});
