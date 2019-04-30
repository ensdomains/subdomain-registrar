pragma solidity ^0.5.0;

import "@ensdomains/ens/contracts/HashRegistrar.sol";
import "@ensdomains/ethregistrar/contracts/BaseRegistrar.sol";

contract SubdomainMigrationRegistrar {

    bytes32 constant public TLD_NODE = 0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae;

    HashRegistrar public hashRegistrar;
    BaseRegistrar public ethRegistrar;

    address public previousRegistrar;
    address payable public newRegistrar;

    modifier onlyPreviousRegistrar {
        require(msg.sender == previousRegistrar);
        _;
    }

    constructor(
        address _previousRegistrar,
        address payable _newRegistrar,
        HashRegistrar _hashRegistrar,
        BaseRegistrar _ethRegistrar
    ) public {
        previousRegistrar = _previousRegistrar;
        newRegistrar = _newRegistrar;
        hashRegistrar = _hashRegistrar;
        ethRegistrar = _ethRegistrar;
    }

    function () external payable { }

    function configureDomainFor(string memory name, uint price, uint referralFeePPM, address payable _owner, address _transfer) public onlyPreviousRegistrar {
        bytes32 label = keccak256(bytes(name));

        uint256 value = deed(label).value();

        hashRegistrar.transferRegistrars(label);

        ethRegistrar.approve(newRegistrar, uint256(label));

        _owner.transfer(value);

        SubdomainMigrationRegistrar(newRegistrar).configureDomainFor(
            name,
            price,
            referralFeePPM,
            _owner,
            _transfer
        );
    }

    function deed(bytes32 label) internal view returns (Deed) {
        (, address deedAddress,,,) = hashRegistrar.entries(label);
        return Deed(deedAddress);
    }
}
