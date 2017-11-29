# ENS Subdomain registrar

[![Build Status](https://travis-ci.org/Arachnid/subdomain-registrar.svg?branch=master)](https://travis-ci.org/Arachnid/subdomain-registrar)

This is a set of smart contracts and corresponding webapp that facilitates easy registration of ENS subdomains for users. By simply entering a desired subdomain name and choosing from a list of available domains, they can register a subdomain and point it at their account in one click.

## Installation

```
git clone https://github.com/Arachnid/subdomain-registrar.git
cd subdomain-registrar
npm install
cd node-modules/truffle
npm install solc@0.4.18
cd ../..
```

## Tests

```
testrpc &
truffle test
```

## Running the dapp

```
testrpc &
truffle deploy
npm run dev
```
