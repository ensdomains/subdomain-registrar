pragma solidity ^0.4.0;

import "./ENS.sol";
import "./HashRegistrarSimplified.sol";

contract DummyDeed is Deed {
  function DummyDeed(address _owner) {
    owner = _owner;
  }

  function transfer(address newOwner) {
    previousOwner = owner;
    owner = newOwner;
  }
}

contract DummyHashRegistrar is HashRegistrarSimplified {
  // namehash('eth')
  bytes32 constant REGISTRAR_NODE = 0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae;

  ENS public ens;
  mapping(bytes32=>DummyDeed) deeds;

  function DummyHashRegistrar(ENS _ens) public {
    ens = _ens;
  }

  function entries(bytes32 label) public view returns (Mode, address, uint, uint, uint) {
    return (HashRegistrarSimplified.Mode.Owned, address(deeds[label]), 0, 0, 0);
  }

  function transfer(bytes32 label, address newOwner) public {
    require(deeds[label].owner() == msg.sender);
    deeds[label].transfer(newOwner);
  }

  function setSubnodeOwner(bytes32 label, address owner) public {
    ens.setSubnodeOwner(REGISTRAR_NODE, label, owner);
    deeds[label] = new DummyDeed(owner);
  }
}
