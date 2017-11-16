require('../open-iconic/font/css/open-iconic-bootstrap.css');
require('html-loader!../index.html');

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
    ENS.setProvider(web3.currentProvider);

    try {
      self.registrar = await SubdomainRegistrar.deployed();
      self.ens = await ENS.deployed();

      // Get the address of the current public resolver
      self.resolverAddress = await self.ens.resolver(namehash.hash('resolver.eth'));
      console.log(self.resolverAddress);
    } catch(e) {
      $("#wrongnetworkmodal").modal('show');
    }

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
          for(var domain of domainnames) {
            self.checkDomain(domain, subdomain);
          }
        }
    }, 500));
  },
  clearDomains: function() {
    $('#results').empty();
  },
  checkDomain: async function(domain, subdomain) {
    var name = subdomain + "." + domain + "." + tld;

    var item = $('<a href="#" class="list-group-item list-group-item-action flex-column align-items-start disabled">');

    var namediv = $('<div class="d-flex w-100 justify-content-between">');
    namediv.append($('<h5 class="mb-1">').text(name));
    var icon = $('<span class="icon">');
    namediv.append(icon.append($('<span class="oi oi-ellipses">')));
    item.append(namediv);

    $('#results').append(item);

    var info = await this.registrar.query('0x' + sha3(domain), subdomain);
    item.removeClass("disabled");
    this.setItemState(domain, subdomain, item, info);
  },
  setItemState: function(domain, subdomain, item, info) {
    if(info[0] == "") {
      $(".icon", item).empty().append($('<span class="oi oi-circle-x">'));
      item.removeClass("list-group-item-success");
      item.addClass("list-group-item-danger");
    } else {
      var cost = web3.fromWei(info[1]);
      $(".icon", item).empty().append($('<span class="badge badge-primary badge-pill">').text("Ξ" + cost));
      item.removeClass("list-group-item-danger");
      item.addClass("list-group-item-success");
      item.click(() => this.buySubdomain(domain, subdomain, item, info));
    }
  },
  buySubdomain: async function(domain, subdomain, item, info) {
    if(readOnly) {
      $("#readonlymodal").modal('show');
      return;
    }

    $(".domainname").text(subdomain + "." + domain + "." + tld);
    $("#registeringmodal").modal('show');
    var tx = await this.registrar.register(
      '0x' + sha3(domain),
      subdomain,
      web3.eth.accounts[0],
      referrerAddress,
      this.resolverAddress,
      {
        from: web3.eth.accounts[0],
        value: info[1],
      });
    $("#etherscan").attr("href", "https://etherscan.io/tx/" + tx.tx);
    $("#registeringmodal").modal('hide');
    $("#registeredmodal").modal('show');
    info[0] = '';
    this.setItemState(domain, subdomain, item, info);
  }
};

window.addEventListener('load', function() {
  // Checking if Web3 has been injected by the browser (Mist/MetaMask)
  if (typeof web3 !== 'undefined') {
    // Use Mist/MetaMask's provider
    window.web3 = new Web3(web3.currentProvider);
    window.readOnly = false;
  } else {
    window.web3 = new Web3(new Web3.providers.HttpProvider("https://mainnet.infura.io/Rg6BrBl8vIqJBc7AlL9h"));
    window.readOnly = true;
  }

  App.start();
});
