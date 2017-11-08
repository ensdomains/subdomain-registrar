pragma solidity ^0.4.0;

contract RegistrarInterface {
  event OwnerChanged(bytes32 indexed name, address indexed oldOwner, address indexed newOwner);
  event DomainConfigured(bytes32 indexed name);
  event DomainUnlisted(bytes32 indexed name);
  event NewRegistration(bytes32 indexed name, string label, address indexed owner, address indexed referrer, uint price);

  function query(bytes32 label, string subdomain) view returns(string domain, uint price, uint rent, uint referralFeePPM);
  function register(bytes32 label, string subdomain, address subdomainOwner, address referrer) public payable;
  function supportsInterface(bytes4 interfaceID) constant returns (bool);

  function rentDue(bytes32 label, string subdomain) public view returns(uint timestamp);
  function payRent(bytes32 label, string subdomain) public payable;
}
