pragma solidity ^0.5.0;

contract SubdomainMigrationRegistrar {

    bytes32 constant public TLD_NODE = 0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae;

    address public previousRegistrar;
    address public newRegistrar;

    modifier onlyPreviousRegistrar {
        require(msg.sender == previousRegistrar);
        _;
    }

    constructor(address _previousRegistrar, address _newRegistrar) public {
        previousRegistrar = _previousRegistrar;
        newRegistrar = __newRegistrar;
    }

    function configureDomainFor(string name, uint price, uint referralFeePPM, address _owner, address _transfer) public onlyPreviousRegistrar {
        bytes32 label = keccak256(name);

        // @todo run upgrade

        SubdomainMigrationRegistrar(newRegistrar).configureDomainFor(
            name,
            price,
            referralFeePPM,
            _owner,
            _transfer
        );
    }

}
