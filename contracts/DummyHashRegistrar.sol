pragma solidity ^0.4.0;

import "./ENS.sol";
import "./HashRegistrarSimplified.sol";

contract DummyHashRegistrar is HashRegistrarSimplified {
  // namehash('eth')
  bytes32 constant REGISTRAR_NODE = 0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae;

  ENS public ens;
  mapping(bytes32=>address) owners;

  function DummyHashRegistrar(ENS _ens) public {
    ens = _ens;
  }

  function entries(bytes32 _hash) public view returns (Mode, address, uint, uint, uint) {
    return (HashRegistrarSimplified.Mode.Owned, owners[_hash], 0, 0, 0);
  }

  function transfer(bytes32 _hash, address newOwner) public {
    require(owners[_hash] == msg.sender);
    owners[_hash] = newOwner;
  }

  function setSubnodeOwner(bytes32 label, address owner) public {
    ens.setSubnodeOwner(REGISTRAR_NODE, label, owner);
  }
}
