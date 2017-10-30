pragma solidity ^0.4.4;

import "./ENS.sol";
import "./BasicResolver.sol";

/**
 * @dev Implements an ENS registrar that sells subdomains on behalf of their owners.
 *
 * Users may register a subdomain by calling `register` with the name of the domain
 * they wish to register under, and the label hash of the subdomain they want to
 * register. They must also specify the new owner of the domain, and the referrer,
 * who is paid an optional finder's fee. The registrar then configures a simple
 * default resolver, which resolves `addr` lookups to the new owner, and sets
 * the `owner` account as the owner of the subdomain in ENS.
 *
 * New domains may be added by calling `configureDomain`, then transferring
 * ownership in the ENS registry to this contract. Ownership in the contract
 * may be transferred using `transfer`, and a domain may be unlisted for sale
 * using `unlistDomain`. There is (deliberately) no way to recover ownership
 * in ENS once the name is transferred to this registrar.
 *
 * Critically, this contract does not check two key properties of a listed domain:
 *
 * - Is the name UTS46 normalised?
 * - Is the Deed held by an appropriate custodian contract?
 *
 * User applications MUST check these two elements for each domain before
 * offering them to users for registration.
 *
 * Applications should additionally check that the domains they are offering to
 * register are controlled by this registrar, since calls to `register` will
 * fail if this is not the case.
 */
contract SubdomainRegistrar {
  // namehash('eth')
  bytes32 constant public TLD_NODE = 0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae;

  ENS public ens;
  BasicResolver public basicResolver;

  struct Domain {
    string name;
    address owner;
    uint price;
    uint referralFeePPM;
  }

  mapping(bytes32=>Domain) public domains;

  event OwnerChanged(bytes32 indexed name, address indexed oldOwner, address indexed newOwner);
  event DomainConfigured(bytes32 indexed name, uint price, uint referralFeePPM);
  event DomainUnlisted(bytes32 indexed name);
  event NewRegistration(bytes32 indexed name, bytes32 label, address indexed owner, address indexed referrer, uint price);

  function SubdomainRegistrar(ENS _ens) public {
    ens = _ens;
    basicResolver = new BasicResolver(_ens);
  }

  /**
   * @dev owner returns the address of the account that controls a domain.
   *      Initially this is the owner of the name in ENS. If the name has been
   *      transferred to this contract, then the internal mapping is consulted
   *      to determine who controls it.
   * @param label The label hash of the deed to check.
   * @return The address owning the deed.
   */
  function owner(bytes32 label) public view returns(address ret) {
      ret = ens.owner(keccak256(TLD_NODE, label));
      if(ret == address(this)) {
        ret = domains[label].owner;
      }
  }

  modifier owner_only(bytes32 label) {
      require(owner(label) == msg.sender);
      _;
  }

  /**
   * @dev Transfers internal control of a name to a new account. Does not update
   *      ENS.
   * @param name The name to transfer.
   * @param newOwner The address of the new owner.
   */
  function transfer(string name, address newOwner) public owner_only(keccak256(name)) {
    var label = keccak256(name);
    OwnerChanged(keccak256(name), domains[label].owner, newOwner);
    domains[label].owner = newOwner;
  }

  /**
   * @dev Configures a domain for sale.
   * @param name The name to configure.
   * @param price The price in wei to charge for subdomain registrations
   * @param referralFeePPM The referral fee to offer, in parts per million
   */
  function configureDomain(string name, uint price, uint referralFeePPM) public owner_only(keccak256(name)) {
    var label = keccak256(name);
    var domain = domains[label];

    if(keccak256(domain.name) != label) {
      // New listing
      domain.name = name;
    }
    if(domain.owner != msg.sender) {
      domain.owner = msg.sender;
    }
    domain.price = price;
    domain.referralFeePPM = referralFeePPM;
    DomainConfigured(keccak256(name), price, referralFeePPM);
  }

  /**
   * @dev Unlists a domain
   * May only be called by the owner.
   * @param name The name of the domain to unlist.
   */
  function unlistDomain(string name) public owner_only(keccak256(name)) {
    var label = keccak256(name);
    var domain = domains[label];
    DomainUnlisted(label);

    domain.name = '';
    domain.owner = owner(label);
    domain.price = 0;
    domain.referralFeePPM = 0;
  }

  /**
   * @dev Registers a subdomain.
   * @param name The name to register a subdomain of.
   * @param label The desired subdomain label hash.
   * @param subdomainOwner The account that should own the newly configured subdomain.
   * @param referrer The address of the account to receive the referral fee.
   */
  function register(string name, bytes32 label, address subdomainOwner, address referrer) public payable {
    var domainLabel = keccak256(name);
    var domainNode = keccak256(TLD_NODE, domainLabel);

    // Subdomain must not be registered already.
    require(ens.owner(keccak256(domainNode, label)) == address(0));

    var domain = domains[domainLabel];

    // Domain must be available for registration
    require(keccak256(domain.name) == domainLabel);

    // User must have paid enough
    require(msg.value >= domain.price);

    // Send any extra back
    if(msg.value > domain.price) {
      msg.sender.transfer(domain.price - msg.value);
    }

    // Send any referral fee
    var total = domain.price;
    if(domain.referralFeePPM > 0 && referrer != 0) {
      var referralFee = (domain.price * domain.referralFeePPM) / 1000000;
      referrer.transfer(referralFee);
      total -= referralFee;
    }

    // Send the registration fee
    domain.owner.transfer(total);

    // Register the domain
    if(subdomainOwner == 0) {
      subdomainOwner = msg.sender;
    }

    doRegistration(domainNode, label, subdomainOwner);
    NewRegistration(keccak256(name), label, subdomainOwner, referrer, domain.price);
  }

  function doRegistration(bytes32 node, bytes32 label, address subdomainOwner) internal {
    ens.setSubnodeOwner(node, label, this);

    var subnode = keccak256(node, label);
    ens.setResolver(subnode, basicResolver);
    ens.setOwner(subnode, subdomainOwner);
  }
}
