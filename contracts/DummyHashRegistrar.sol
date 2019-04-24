pragma solidity ^0.5.0;

import "@ensdomains/ens/contracts/ENS.sol";
import "./HashRegistrarSimplified.sol";
import "./Deed.sol";

interface Registrar {
    function acceptRegistrarTransfer(bytes32 label, address deed, uint) external;
}

contract DummyDeed is Deed {
    constructor(address _owner) public {
        owner = _owner;
    }

    function transfer(address newOwner) public {
        previousOwner = owner;
        owner = newOwner;
    }
}


contract DummyHashRegistrar is HashRegistrarSimplified {
    ENS public ens;

    mapping (bytes32 => DummyDeed) deeds;

    constructor(ENS _ens) public {
        ens = _ens;
        // namehash('eth')
        rootNode = 0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae;
    }

    function entries(bytes32 label) public view returns (Mode, address, uint, uint, uint) {
        return (HashRegistrarSimplified.Mode.Owned, address(deeds[label]), 0, 0, 0);
    }

    function transfer(bytes32 label, address newOwner) public {
        require(deeds[label].owner() == msg.sender);
        deeds[label].transfer(newOwner);

        if (ens.owner(rootNode) == address(this)) {
            ens.setSubnodeOwner(rootNode, label, newOwner);
        }
    }

    function setSubnodeOwner(bytes32 label, address owner) public {
        ens.setSubnodeOwner(rootNode, label, owner);
        deeds[label] = new DummyDeed(owner);
    }

    function transferRegistrars(bytes32 label) external {
        require(deeds[label].owner() == msg.sender);
        address registrar = ens.owner(rootNode);
        require(registrar != address(this));

        Registrar(registrar).acceptRegistrarTransfer(label, address(deeds[label]), 0);
    }
}
