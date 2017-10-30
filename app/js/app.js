import { default as Web3} from 'web3';
import { default as contract } from 'truffle-contract'

import subdomainregistrar_artifacts from '../../build/contracts/SubdomainRegistrar.json'
var SubdomainRegistrar = contract(subdomainregistrar_artifacts);

var namehash = require('eth-ens-namehash');
var _ = require('underscore');

window.App = {
  start: function() {
    var self = this;

    SubdomainRegistrar.setProvider(web3.currentProvider);

    $("#name").keyup(_.debounce(function() {
        var name = $("#name").val().trim();

        alert(namehash.normalize(name));
    }, 500));
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
