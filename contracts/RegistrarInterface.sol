pragma solidity ^0.4.0;

contract RegistrarInterface {
  event OwnerChanged(bytes32 indexed name, address indexed oldOwner, address indexed newOwner);
  event DomainConfigured(bytes32 indexed name);
  event NewRegistration(bytes32 indexed name, string label, address indexed owner, address indexed referrer, uint price);

  function query(bytes32 label, string subdomain) view returns(string domain, uint price, uint rent, uint referralFeePPM);
  function register(string name, string subdomain, address subdomainOwner, address referrer) public payable;
}
