pragma solidity ^0.4.0;

contract RegistrarInterface {
  event OwnerChanged(bytes32 indexed label, address indexed oldOwner, address indexed newOwner);
  event DomainConfigured(bytes32 indexed label);
  event DomainUnlisted(bytes32 indexed label);
  event NewRegistration(bytes32 indexed label, string subdomain, address indexed owner, address indexed referrer, uint price);
  event RentPaid(bytes32 indexed label, string subdomain, uint amount, uint expirationDate);

  // InterfaceID of these four methods is 0xc898e728
  function query(bytes32 label, string subdomain) view returns(string domain, uint signupFee, uint rent, uint referralFeePPM);
  function register(bytes32 label, string subdomain, address owner, address referrer) public payable;

  function rentDue(bytes32 label, string subdomain) public view returns(uint timestamp);
  function payRent(bytes32 label, string subdomain) public payable;
}
