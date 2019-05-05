# ENS Subdomain registrar

[![Build Status](https://travis-ci.org/ensdomains/subdomain-registrar.svg?branch=master)](https://travis-ci.org/ensdomains/subdomain-registrar) [![License](https://img.shields.io/badge/License-BSD--2--Clause-blue.svg)](LICENSE)

This is a set of smart contracts and corresponding webapp that facilitates easy registration of ENS subdomains for users. By simply entering a desired subdomain name and choosing from a list of available domains, they can register a subdomain and point it at their account in one click.

This code is currently BETA. Prior versions of the smart contract have been audited, but changes have been made subsequently, for which an audit has not yet been completed. Use with care.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Installing

The ENS Subdomain registrar uses npm to manage dependencies, therefore the installation process is kept simple:

```
npm install
```

### Running tests

The ENS Subdomain registrar uses truffle for its ethereum development environment. All tests can be run using truffle:

```
truffle test
```

To run linting, use solium:

```
solium --dir ./contracts
```

### Running the dapp

```
ganache-cli &
truffle deploy
npm run dev
```

## Operation

`SubdomainRegistrar` implements a contract that takes ownership of (multiple) .eth domains, and sells subdomains to users for a simple one-time fee. When users register a subdomain, it is automatically configured with a default resolver and pointed at their account. This permits easy one-transaction claiming and assignment of an ENS domain for users, significantly improving the ENS user-experience.

A variety of frontends can be built to interact with the subdomain registrar; a simple implementation is provided in this repository. Domain owners may set a 'commission rate', which is a percentage fee that is sent to the address the frontend nominates. This can be any amount, but frontends are free to set criteria for inclusion or prioritisation based on the fee paid.

There is no functionality in the contract for listing or querying domains that are registered with it, though events are emitted when new domains are registered. To avoid spamming with low-quality domains, we recommend that frontend operators maintain a whitelist of domains to offer subdomain registrations on.

### Adding a domain

Any .eth domain owner may use this contract by:

 1. Transferring ownership of the Deed to the deployed contract.
 2. Calling `configureDomain(name, price, referralFeePPM)`, where `name` is the name of the domain (without .eth), price is the price in wei to charge for a subdomain registration, and `referralFeePPM` is the referral fee to offer to frontends, in parts-per-million.
 3. Getting the new domain whitelisted with frontends so users can buy it.

Note that this process is IRREVOCABLE! For the security of customers, once you have transferred your domain to the subdomain registrar, you cannot claim it back except under very limited circumstances (see below).

### Upgrades to the subdomain registrar

In the event of a bug or issue with the subdomain registrar being found, a migration path to a new implementation is provided. The owner of the subdomain registrar may halt new registrations, followed by setting a migration address to a new implementation. Afterwards, domain owners may call `migrate` to transfer ownership of their domain to the new implementation. Only domain owners may do this, so as to prevent the owner of the subdomain registrar from being able to sieze ownership of the names.

### Upgrades to the .eth registrar

The current .eth registrar is an interim implementation, and is expected to be replaced in the near future. This is likely to be accompanied by a change in API, which makes catering to this in existing contracts difficult. To avoid this, the subdomain registrar implements a precommitment strategy.

At any point, the owner of a domain may specify a 'transfer address' for their domain. Once a transfer address is set, it may not be changed or unset. At the point at which the .eth registrar is replaced (and not before), the owner may call the `upgrade` function, transferring ownership of the Deed to this address.

The intended workflow is as follows:

 1. A new .eth registrar is deployed, but not yet activated. Users are advised of a migration date.
 2. Domain owners on the subdomain registrar set the transfer address for their domains to that of a 'migration contract' that will handle upgrading the domain to the new registrar and committing it to a new subdomain registrar.
 3. Users have an opportunity to evaluate the upgrade path, and stop using their subdomains if unhappy with it.
 3. The .eth registrar upgrade happens.
 4. The domain owner calls `upgrade`, transferring ownership and performing the upgrade process.

## Built With
* [Truffle](https://github.com/trufflesuite/truffle) - Ethereum development environment


## Authors

* **Nick Johnson** - [Arachnid](https://github.com/Arachnid)
* **Dean Eigenmann** - [decanus](https://github.com/decanus)

See also the list of [contributors](https://github.com/ensdomains/subdomain-registrar/contributors) who participated in this project.

## License

This project is licensed under the BSD 2-clause "Simplified" License - see the [LICENSE](LICENSE) file for details
