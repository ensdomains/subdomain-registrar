pragma solidity ^0.4.17;

contract Deed {
    address public owner;
    address public previousOwner;
}

contract HashRegistrarSimplified {
    enum Mode { Open, Auction, Owned, Forbidden, Reveal, NotYetAvailable }

    bytes32 public rootNode;

    function entries(bytes32 _hash) public view returns (Mode, address, uint, uint, uint);
    function transfer(bytes32 _hash, address newOwner) public;
}
